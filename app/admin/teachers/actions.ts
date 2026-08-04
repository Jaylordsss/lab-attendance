"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { normalizeFacultyId, isValidFacultyId } from "@/lib/auth";

export type TeacherState = {
  error: string | null;
  created: { name: string; email: string; tempPassword: string } | null;
};

export async function createTeacher(
  _prev: TeacherState,
  formData: FormData,
): Promise<TeacherState> {
  const admin = await requireAdmin();

  const fullName = str(formData, "fullName");
  const facultyId = normalizeFacultyId(str(formData, "facultyId"));
  const department = str(formData, "department");
  const email = str(formData, "email").toLowerCase();
  const contactNo = str(formData, "contactNo");

  if (!fullName || !facultyId || !department || !email) {
    return fail("Fill in name, faculty ID, department and email.");
  }
  if (!isValidFacultyId(facultyId)) {
    return fail("Faculty ID must be 3–20 letters, numbers or dashes.");
  }
  if (!email.includes("@") || email.endsWith("@students.invalid")) {
    return fail("Use a real email address the teacher can receive mail at.");
  }

  // Shown to the admin once, then never retrievable. The teacher changes it on
  // first sign-in.
  const tempPassword = randomBytes(9).toString("base64url");

  const supabase = getServiceClient();

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

  if (createErr || !created.user) {
    return fail("Couldn't create the account. That email may already be in use.");
  }

  const userId = created.user.id;

  const { error: profileErr } = await supabase
    .from("profiles")
    .insert({ id: userId, role: "teacher", full_name: fullName });

  if (profileErr) {
    await supabase.auth.admin.deleteUser(userId);
    return fail("Couldn't create the teacher's profile. Try again.");
  }

  const { error: staffErr } = await supabase.from("staff").insert({
    user_id: userId,
    faculty_id: facultyId,
    department,
    contact_no: contactNo || null,
  });

  if (staffErr) {
    await supabase.auth.admin.deleteUser(userId);
    return fail(
      staffErr.code === "23505"
        ? `Faculty ID ${facultyId} is already registered.`
        : "Couldn't save the teacher's details. Try again.",
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "teacher_created",
    target: userId,
    detail: { faculty_id: facultyId, department },
  });

  revalidatePath("/admin/teachers");
  return { error: null, created: { name: fullName, email, tempPassword } };
}

function fail(error: string): TeacherState {
  return { error, created: null };
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

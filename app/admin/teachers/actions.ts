"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { normalizeFacultyId, isValidFacultyId } from "@/lib/auth";

export type TeacherState = {
  error: string | null;
  created: { name: string; email: string; password: string } | null;
};

const MIN_PASSWORD = 8;

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

  // Admin may set the password, or leave it blank for a generated one.
  const chosen = String(formData.get("password") ?? "");
  const password = chosen || randomBytes(9).toString("base64url");

  if (!fullName || !facultyId || !department || !email) {
    return fail("Fill in name, faculty ID, department and email.");
  }
  if (!isValidFacultyId(facultyId)) {
    return fail("Faculty ID must be 3–20 letters, numbers or dashes.");
  }
  if (!email.includes("@") || email.endsWith("@students.invalid")) {
    return fail("Use a real email address the teacher can receive mail at.");
  }
  if (chosen && chosen.length < MIN_PASSWORD) {
    return fail(`A password you set must be at least ${MIN_PASSWORD} characters.`);
  }

  const supabase = getServiceClient();

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createErr || !created.user) {
    return fail("Couldn't create the account. That email may already be in use.");
  }

  const userId = created.user.id;

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: userId,
    role: "teacher",
    full_name: fullName,
    // Flagged until they choose their own. The app prompts them at sign-in.
    must_change_password: true,
  });

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
        : `Couldn't save the teacher's details (${staffErr.message}).`,
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "teacher_created",
    target: userId,
    detail: { faculty_id: facultyId, department, password_set_by_admin: Boolean(chosen) },
  });

  revalidatePath("/admin/teachers");
  revalidatePath("/admin/users");
  return { error: null, created: { name: fullName, email, password } };
}

/** Issues a new temporary password. Used when someone is locked out. */
export async function resetPassword(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const newPassword = randomBytes(9).toString("base64url");

  const supabase = getServiceClient();
  await supabase.auth.admin.updateUserById(userId, { password: newPassword });
  await supabase
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "password_reset",
    target: userId,
  });

  revalidatePath("/admin/users");
}

function fail(error: string): TeacherState {
  return { error, created: null };
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

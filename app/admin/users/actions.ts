"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import {
  normalizeFacultyId,
  isValidFacultyId,
  normalizeStudentNo,
} from "@/lib/auth";

export type EditState = { error: string | null; success: string | null };

/**
 * Sets a person's ID number, and their department if they are staff.
 *
 * Two different columns sit behind one field: students have `student_no`,
 * staff have `faculty_id`. The role decides which, so the admin never has to
 * think about it.
 */
export async function updateIdentifier(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const admin = await requireAdmin();

  const userId = str(formData, "userId");
  const role = str(formData, "role");
  const identifier = str(formData, "identifier");
  const department = str(formData, "department");

  if (!userId || !identifier) {
    return fail("Enter an ID number.");
  }

  const supabase = getServiceClient();

  if (role === "student") {
    const studentNo = normalizeStudentNo(identifier);

    const { error } = await supabase
      .from("students")
      .update({ student_no: studentNo })
      .eq("user_id", userId);

    if (error) {
      return fail(
        error.code === "23505"
          ? `Student number ${studentNo} is already taken.`
          : "Couldn't save that student number.",
      );
    }

    await audit(admin.id, "student_no_changed", userId, { studentNo });
    revalidatePath("/admin/users");
    return ok(`Saved ${studentNo}.`);
  }

  // Admin or teacher.
  const facultyId = normalizeFacultyId(identifier);
  if (!isValidFacultyId(facultyId)) {
    return fail("Faculty ID must be 3–20 letters, numbers or dashes.");
  }
  if (!department) {
    return fail("Choose a department.");
  }

  // upsert, because an account created before the staff table existed has no
  // row to update.
  const { error } = await supabase
    .from("staff")
    .upsert(
      { user_id: userId, faculty_id: facultyId, department },
      { onConflict: "user_id" },
    );

  if (error) {
    return fail(
      error.code === "23505"
        ? `Faculty ID ${facultyId} is already taken.`
        : "Couldn't save those details.",
    );
  }

  await audit(admin.id, "faculty_id_changed", userId, { facultyId, department });
  revalidatePath("/admin/users");
  revalidatePath("/admin/teachers");
  return ok(`Saved ${facultyId}.`);
}

/** Issues a new temporary password when someone is locked out. */
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

  await audit(admin.id, "password_reset", userId, {});
  revalidatePath("/admin/users");
}

/** Clears a student's device binding so they can scan from a new phone. */
export async function unbindDevice(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));

  await getServiceClient()
    .from("students")
    .update({ device_id: null, device_bound_at: null })
    .eq("user_id", userId);

  await audit(admin.id, "device_unbound", userId, {});
  revalidatePath("/admin/users");
}

function ok(success: string): EditState {
  return { error: null, success };
}
function fail(error: string): EditState {
  return { error, success: null };
}
function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}
async function audit(
  actorId: string,
  action: string,
  target: string,
  detail: Record<string, unknown>,
) {
  await getServiceClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target, detail });
}

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

/** Carries the issued password back so the admin can read it out once. */
export type PasswordResult = {
  error: string | null;
  password: string | null;
  name: string | null;
};

const MIN_PASSWORD = 8;

/* ------------------------------------------------------------------ *
 * Identifiers
 * ------------------------------------------------------------------ */

export async function updateIdentifier(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const admin = await requireAdmin();

  const userId = str(formData, "userId");
  const role = str(formData, "role");
  const identifier = str(formData, "identifier");
  const department = str(formData, "department");

  if (!userId || !identifier) return fail("Enter an ID number.");

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

  const facultyId = normalizeFacultyId(identifier);
  if (!isValidFacultyId(facultyId)) {
    return fail("Faculty ID must be 3–20 letters, numbers or dashes.");
  }
  if (!department) return fail("Choose a department.");

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

/* ------------------------------------------------------------------ *
 * Passwords
 * ------------------------------------------------------------------ */

/**
 * Issues a random password and returns it once.
 *
 * Returning it matters: a reset the admin cannot read is a reset that locks
 * the person out. Students in particular have no inbox to receive one.
 */
export async function resetPassword(
  _prev: PasswordResult,
  formData: FormData,
): Promise<PasswordResult> {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const name = str(formData, "name");

  if (!userId) return { error: "Missing account.", password: null, name: null };

  const password = randomBytes(9).toString("base64url");
  const result = await applyPassword(admin.id, userId, password, "password_reset");

  return result ?? { error: null, password, name };
}

/** Sets a password the admin chose, for reading out over the phone. */
export async function setPassword(
  _prev: PasswordResult,
  formData: FormData,
): Promise<PasswordResult> {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const name = str(formData, "name");
  const password = String(formData.get("password") ?? "");

  if (!userId) return { error: "Missing account.", password: null, name: null };
  if (password.length < MIN_PASSWORD) {
    return {
      error: `Use at least ${MIN_PASSWORD} characters.`,
      password: null,
      name: null,
    };
  }

  const result = await applyPassword(admin.id, userId, password, "password_set");

  return result ?? { error: null, password, name };
}

/**
 * Writes the password and flags the account so the person is asked to choose
 * their own at next sign-in. Returns null on success, or an error result.
 */
async function applyPassword(
  adminId: string,
  userId: string,
  password: string,
  action: string,
): Promise<PasswordResult | null> {
  const supabase = getServiceClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return {
      error: "Couldn't change that password. Try again.",
      password: null,
      name: null,
    };
  }

  await supabase
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  await audit(adminId, action, userId, {});
  revalidatePath("/admin/users");
  return null;
}

/* ------------------------------------------------------------------ *
 * Devices
 * ------------------------------------------------------------------ */

/**
 * Clears a student's device binding.
 *
 * Needed when someone changes handset or clears their browser data. Their
 * next scan binds whatever phone they scan from, so this should be a
 * deliberate act rather than a stray click — hence the confirmation.
 */
export async function unbindDevice(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const name = str(formData, "name");

  if (!userId) return fail("Missing account.");

  const { error } = await getServiceClient()
    .from("students")
    .update({ device_id: null, device_bound_at: null })
    .eq("user_id", userId);

  if (error) return fail("Couldn't unbind that phone.");

  await audit(admin.id, "device_unbound", userId, {});
  revalidatePath("/admin/users");
  return ok(`${name || "That student"} can now scan from a new phone.`);
}

/* ------------------------------------------------------------------ */

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

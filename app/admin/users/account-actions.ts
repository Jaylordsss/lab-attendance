"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type AccountState = { error: string | null; success: string | null };

const ok = (success: string): AccountState => ({ error: null, success });
const fail = (error: string): AccountState => ({ error, success: null });

type Footprint = {
  full_name: string;
  role: string;
  attendance_rows: number;
  sections_taught: number;
  enrolments: number;
  is_last_admin: boolean;
};

/**
 * Runs as the signed-in administrator, not the service role.
 *
 * account_footprint checks is_admin(), which reads auth.uid() — and the
 * service role has no user identity, so the check failed and the function
 * raised. The empty result then read as "that account no longer exists".
 */
async function footprintOf(userId: string): Promise<Footprint | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("account_footprint", {
    p_user_id: userId,
  });

  if (error) console.error("account_footprint:", error.message);
  return ((data ?? []) as Footprint[])[0] ?? null;
}

/**
 * Blocks sign-in without touching anything the account owns.
 *
 * The right answer for a student who has left or a teacher on leave: their
 * attendance stays in the register, their name stays on last term's reports,
 * and nothing has to be reconstructed if they come back.
 */
export async function suspendAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!userId) return fail("Missing account.");
  if (userId === admin.id) {
    return fail("You can't suspend your own account.");
  }

  const supabase = getServiceClient();

  const footprint = await footprintOf(userId);
  if (footprint?.is_last_admin) {
    return fail("This is the only administrator. Create another one first.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", userId);

  if (error) return fail("Couldn't suspend that account.");

  // Existing sessions are ended, so suspension takes effect immediately
  // rather than whenever their current one happens to expire.
  await supabase.auth.admin.signOut(userId, "global").catch(() => {});

  await audit(admin.id, "account_suspended", userId, {});
  revalidatePath("/admin/users");
  return ok(`${name} can no longer sign in.`);
}

export async function reactivateAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!userId) return fail("Missing account.");

  const { error } = await getServiceClient()
    .from("profiles")
    .update({ status: "active" })
    .eq("id", userId);

  if (error) return fail("Couldn't reactivate that account.");

  await audit(admin.id, "account_reactivated", userId, {});
  revalidatePath("/admin/users");
  return ok(`${name} can sign in again.`);
}

/**
 * Removes an account. Its attendance record stays.
 *
 * For a student who has transferred or left. Each attendance row carries the
 * number and name it was written with, so past registers and every PDF read
 * exactly as they did before — the row simply stops pointing at an account
 * that no longer exists.
 *
 * Suspension remains the better choice for someone who may return, since it
 * is reversible and keeps them on their rosters.
 */
export async function deleteAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "");
  const confirmation = String(formData.get("confirm") ?? "").trim();

  if (!userId) return fail("Missing account.");

  // An administrator deleting themselves would be locked out with no way back
  // in — the setup route closes permanently once an admin exists.
  if (userId === admin.id) {
    return fail("You can't delete your own account.");
  }

  if (confirmation.toUpperCase() !== "DELETE") {
    return fail("Type DELETE to confirm.");
  }

  const footprint = await footprintOf(userId);
  if (!footprint) return fail("That account no longer exists.");

  if (footprint.is_last_admin) {
    return fail("This is the only administrator. Create another one first.");
  }

  if (Number(footprint.sections_taught) > 0) {
    return fail(
      `${name} still teaches ${footprint.sections_taught} section${footprint.sections_taught === 1 ? "" : "s"}. Reassign them first.`,
    );
  }

  const supabase = getServiceClient();

  // Deleting the auth user cascades through profiles to students or staff.
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("delete account:", error.message);
    return fail("Couldn't delete that account.");
  }

  await audit(admin.id, "account_deleted", userId, {
    name,
    attendance_rows_kept: footprint.attendance_rows,
  });
  revalidatePath("/admin/users");

  return ok(
    Number(footprint.attendance_rows) > 0
      ? `${name} deleted. Their ${footprint.attendance_rows} attendance records stay in the register.`
      : `${name} deleted.`,
  );
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

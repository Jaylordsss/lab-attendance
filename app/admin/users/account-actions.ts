"use server";

import { revalidatePath } from "next/cache";
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

async function footprintOf(userId: string): Promise<Footprint | null> {
  const { data } = await getServiceClient().rpc("account_footprint", {
    p_user_id: userId,
  });
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
 * Removes an account and everything cascading from it.
 *
 * Refused whenever there is history to lose. Deleting a student takes their
 * attendance rows with them, which quietly rewrites past registers — a class
 * that had thirty present last term would afterwards show twenty-nine, with
 * no record that anything changed.
 *
 * So this is for accounts created in error: a typo'd student number, a
 * duplicate, a teacher who never taught. Everything else is suspended.
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

  if (Number(footprint.attendance_rows) > 0) {
    return fail(
      `${name} has ${footprint.attendance_rows} attendance records. Deleting would remove them from past registers — suspend the account instead.`,
    );
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

  await audit(admin.id, "account_deleted", userId, { name });
  revalidatePath("/admin/users");
  return ok(`${name} deleted.`);
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

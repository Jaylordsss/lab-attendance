"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type AccountState = { error: string | null; success: string | null };

const ok = (success: string): AccountState => ({ error: null, success });
const fail = (error: string): AccountState => ({ error, success: null });

type Footprint = {
  fullName: string;
  role: string;
  attendanceRows: number;
  sectionsTaught: number;
  isLastAdmin: boolean;
};

/**
 * What an account owns, read directly rather than through a database function.
 *
 * An earlier version called a security-definer function that checks
 * is_admin(), which reads auth.uid(). Whichever client it was given, the call
 * had a way of failing — and a failed lookup surfaced as "that account no
 * longer exists", which was both wrong and alarming. Four plain queries on the
 * service client have no such dependency, and requireAdmin() above has already
 * established who is asking.
 */
async function footprintOf(userId: string): Promise<Footprint | null> {
  const supabase = getServiceClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) console.error("footprint profile:", error.message);
  if (!profile) return null;

  const [attendance, sections, admins] = await Promise.all([
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId),
    supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", userId),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),
  ]);

  return {
    fullName: profile.full_name as string,
    role: profile.role as string,
    attendanceRows: attendance.count ?? 0,
    sectionsTaught: sections.count ?? 0,
    isLastAdmin: profile.role === "admin" && (admins.count ?? 0) <= 1,
  };
}

/**
 * Blocks sign-in without touching anything the account owns.
 *
 * The right answer for a student who has left temporarily or a teacher on
 * leave: their attendance stays, their name stays on the roster, and nothing
 * has to be reconstructed if they return.
 */
export async function suspendAccount(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!userId) return fail("Missing account.");
  if (userId === admin.id) return fail("You can't suspend your own account.");

  const footprint = await footprintOf(userId);
  if (!footprint) return fail("Couldn't find that account.");
  if (footprint.isLastAdmin) {
    return fail("This is the only administrator. Create another one first.");
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", userId);

  if (error) {
    console.error("suspend:", error.message);
    return fail("Couldn't suspend that account.");
  }

  // Existing sessions are ended, so suspension takes effect immediately
  // rather than whenever their current one happens to expire.
  await supabase.auth.admin.signOut(userId, "global").catch(() => {});

  await audit(admin.id, "account_suspended", userId, { name });
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

  if (error) {
    console.error("reactivate:", error.message);
    return fail("Couldn't reactivate that account.");
  }

  await audit(admin.id, "account_reactivated", userId, { name });
  revalidatePath("/admin/users");
  return ok(`${name} can sign in again.`);
}

/**
 * Removes the account. Its attendance record stays.
 *
 * For a student who has transferred or dropped out. Each attendance row
 * carries the number and name it was written with, so past registers and
 * every PDF read exactly as they did before — the row simply stops pointing
 * at an account that no longer exists.
 *
 * Deleting the auth user is what actually removes them: profiles, students
 * and staff all cascade from it, so nothing is left behind in Supabase.
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
  if (userId === admin.id) return fail("You can't delete your own account.");

  if (confirmation.toUpperCase() !== "DELETE") {
    return fail("Type DELETE to confirm.");
  }

  const footprint = await footprintOf(userId);
  if (!footprint) return fail("Couldn't find that account.");

  if (footprint.isLastAdmin) {
    return fail("This is the only administrator. Create another one first.");
  }

  if (footprint.sectionsTaught > 0) {
    return fail(
      `${name} still teaches ${footprint.sectionsTaught} section${footprint.sectionsTaught === 1 ? "" : "s"}. Reassign them first.`,
    );
  }

  const supabase = getServiceClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error("delete account:", error.message);
    return fail(`Couldn't delete that account — ${error.message}`);
  }

  await audit(admin.id, "account_deleted", userId, {
    name,
    attendance_rows_kept: footprint.attendanceRows,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/teachers");

  return ok(
    footprint.attendanceRows > 0
      ? `${name} deleted. Their ${footprint.attendanceRows} attendance records stay in the register.`
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

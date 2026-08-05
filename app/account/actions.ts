"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { piiKey } from "@/lib/require-teacher";
import {
  normalizePhPhone,
  isSyntheticStudentEmail,
  HOME_FOR_ROLE,
} from "@/lib/auth";

export type ActionState = { error: string | null; success: string | null };

const MIN_PASSWORD = 8;
const ok = (success: string): ActionState => ({ error: null, success });
const fail = (error: string): ActionState => ({ error, success: null });

/* ------------------------------------------------------------------ *
 * Password
 * ------------------------------------------------------------------ */

/**
 * Sends a one-time code to the signed-in user's email.
 *
 * Supabase's reauthenticate() is the mechanism: it mails a nonce which
 * updateUser() then requires alongside the new password. That is what makes a
 * stolen unlocked phone insufficient to take over an account.
 *
 * It needs a real inbox, so an account still on a synthetic
 * @students.invalid address cannot use it — those change their password
 * directly, which is no weaker than what they had before.
 */
export async function sendPasswordCode(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.auth.reauthenticate();

  if (error) {
    return fail(
      "Couldn't send the code. Check that your email address is correct and confirmed.",
    );
  }

  return ok("Code sent. Check your email, including spam.");
}

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const nonce = String(formData.get("nonce") ?? "").trim();
  const needsCode = String(formData.get("needsCode") ?? "") === "true";

  if (next.length < MIN_PASSWORD) {
    return fail(`Use at least ${MIN_PASSWORD} characters.`);
  }
  if (next !== confirm) return fail("The two passwords don't match.");
  if (needsCode && !nonce) return fail("Enter the code sent to your email.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    needsCode ? { password: next, nonce } : { password: next },
  );

  if (error) {
    return fail(
      error.message.toLowerCase().includes("nonce")
        ? "That code is wrong or has expired. Send a new one."
        : "Couldn't change your password. Try again.",
    );
  }

  const service = getServiceClient();
  await service
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  await service.from("audit_log").insert({
    actor_id: user.id,
    action: "password_changed",
    target: user.id,
  });

  redirect(HOME_FOR_ROLE[user.role]);
}

/* ------------------------------------------------------------------ *
 * Contact details
 * ------------------------------------------------------------------ */

/** Staff email and mobile. */
export async function updateStaffContact(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "student") return fail("Not permitted.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const contactRaw = String(formData.get("contactNo") ?? "").trim();

  if (!email.includes("@") || isSyntheticStudentEmail(email)) {
    return fail("Enter a real email address.");
  }

  let contactNo: string | null = null;
  if (contactRaw) {
    contactNo = normalizePhPhone(contactRaw);
    if (!contactNo) return fail(phoneError());
  }

  const service = getServiceClient();

  const { error: authErr } = await service.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  });
  if (authErr) {
    return fail(
      authErr.message.includes("already")
        ? "That email is already used by another account."
        : "Couldn't update your email.",
    );
  }

  const { error } = await service
    .from("staff")
    .update({ contact_no: contactNo })
    .eq("user_id", user.id);
  if (error) return fail("Couldn't save your mobile number.");

  await audit(user.id, "contact_updated", { email });
  revalidatePath("/account");
  return ok("Saved.");
}

/**
 * A student's own details.
 *
 * Email is changed through the normal Supabase flow, which sends a
 * confirmation link — so a student cannot lock themselves out by typing an
 * address they do not own. Their student number keeps working as a login
 * either way, because sign-in looks the account up by number.
 */
export async function updateStudentProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") return fail("Not permitted.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const contactRaw = String(formData.get("contactNo") ?? "").trim();
  const guardianRaw = String(formData.get("guardianNo") ?? "").trim();
  const guardianName = String(formData.get("guardianName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();

  let contactNo: string | null = null;
  if (contactRaw) {
    contactNo = normalizePhPhone(contactRaw);
    if (!contactNo) return fail(phoneError("your"));
  }

  let guardianNo: string | null = null;
  if (guardianRaw) {
    guardianNo = normalizePhPhone(guardianRaw);
    if (!guardianNo) return fail(phoneError("your guardian's"));
  }

  const supabase = await createClient();

  // Only touch auth if they actually changed it — an unnecessary update fires
  // a confirmation email every save.
  if (email) {
    const { data } = await supabase.auth.getUser();
    const currentEmail = data.user?.email ?? "";

    if (email !== currentEmail) {
      if (!email.includes("@") || isSyntheticStudentEmail(email)) {
        return fail("Enter a real email address.");
      }
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        return fail(
          error.message.includes("already")
            ? "That email is already used by another account."
            : "Couldn't update your email.",
        );
      }
    }
  }

  const { error } = await supabase.rpc("update_student_profile", {
    p_user_id: user.id,
    p_contact_no: contactNo,
    p_address: address,
    p_guardian_name: guardianName,
    p_guardian_no: guardianNo,
    p_key: piiKey(),
  });

  if (error) return fail("Couldn't save your details. Try again.");

  await audit(user.id, "student_profile_updated", {});
  revalidatePath("/account");

  return ok(
    email
      ? "Saved. If you changed your email, confirm it from the link we sent."
      : "Saved.",
  );
}

/* ------------------------------------------------------------------ */

function phoneError(whose = ""): string {
  const owner = whose ? `${whose} ` : "";
  return `Enter ${owner}Philippine mobile number, like 0917 123 4567.`;
}

async function audit(
  actorId: string,
  action: string,
  detail: Record<string, unknown>,
) {
  await getServiceClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target: actorId, detail });
}

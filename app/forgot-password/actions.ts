"use server";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  normalizeStudentNo,
  normalizeFacultyId,
  isSyntheticStudentEmail,
} from "@/lib/auth";

export type ForgotState = {
  error: string | null;
  sent: boolean;
  maskedEmail: string | null;
  done: boolean;
};

const blank: ForgotState = {
  error: null,
  sent: false,
  maskedEmail: null,
  done: false,
};

const MIN_PASSWORD = 8;

/**
 * Resolves a student number, faculty ID or email to the account's address.
 *
 * Runs server-side through the service client so nothing that maps ID numbers
 * to email addresses is reachable by an unauthenticated caller.
 */
async function resolveEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes("@")) return value.toLowerCase();

  const service = getServiceClient();

  const { data: staff } = await service
    .from("staff")
    .select("user_id")
    .ilike("faculty_id", normalizeFacultyId(value))
    .maybeSingle();

  let userId = staff?.user_id as string | undefined;

  if (!userId) {
    const { data: student } = await service
      .from("students")
      .select("user_id")
      .ilike("student_no", normalizeStudentNo(value))
      .maybeSingle();
    userId = student?.user_id as string | undefined;
  }

  if (!userId) return null;

  const { data } = await service.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/**
 * Step one: email a six-digit code.
 *
 * A code rather than a link. Links depend on the redirect URL being configured
 * for every environment, break when opened in a different browser from the one
 * that asked, and expire in ways that are hard to explain. A code is read off
 * the screen and typed wherever the person already is.
 */
export async function sendCode(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const identifier = String(formData.get("identifier") ?? "").trim();

  if (!identifier) {
    return { ...blank, error: "Enter your ID number or email." };
  }

  const email = await resolveEmail(identifier);

  // An account still on a synthetic address has no inbox. Say so plainly —
  // sending someone away to wait for mail that cannot arrive is worse than
  // telling them who can help.
  if (email && isSyntheticStudentEmail(email)) {
    return {
      ...blank,
      error:
        "This account has no email address, so a code can't be sent. Ask your teacher to reset it for you.",
    };
  }

  if (email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      console.error("send recovery code:", error.message);
      if (error.message.toLowerCase().includes("rate")) {
        return {
          ...blank,
          error: "Too many requests. Wait a few minutes and try again.",
        };
      }
    }
  }

  // The same reply whether or not the account exists. Otherwise this page
  // becomes a way to discover which student numbers are real.
  return {
    ...blank,
    sent: true,
    maskedEmail: email ? maskEmail(email) : null,
  };
}

/**
 * Step two: the code proves who they are, and the new password is set.
 *
 * verifyOtp creates a session from the code, which is what makes updateUser
 * possible without the old password — the person asking has, by definition,
 * forgotten it.
 */
export async function verifyAndReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const sentState = { ...blank, sent: true };

  if (!token) return { ...sentState, error: "Enter the code from your email." };
  if (next.length < MIN_PASSWORD) {
    return { ...sentState, error: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (next !== confirm) {
    return { ...sentState, error: "The two passwords don't match." };
  }

  // Resolved again rather than carried through the form, so a tampered field
  // cannot point the reset at somebody else's account.
  const email = await resolveEmail(identifier);
  if (!email) {
    return { ...sentState, error: "That code is wrong or has expired." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });

  if (error || !data.user) {
    console.error("verify recovery code:", error?.message);
    return {
      ...sentState,
      error: "That code is wrong or has expired. Ask for a new one.",
    };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: next,
  });

  if (updateErr) {
    console.error("reset password:", updateErr.message);
    return { ...sentState, error: "Couldn't set your password. Try again." };
  }

  const service = getServiceClient();
  await service
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", data.user.id);
  await service.from("audit_log").insert({
    actor_id: data.user.id,
    action: "password_reset_by_code",
    target: data.user.id,
  });

  // Signed out deliberately. Ending on the sign-in page with a password they
  // just chose is clearer than being dropped into a dashboard, and it proves
  // the new password works.
  await supabase.auth.signOut();

  return { ...blank, done: true };
}

/** j****d@gmail.com — enough to recognise, not enough to harvest. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 5))}${local.at(-1)}@${domain}`;
}

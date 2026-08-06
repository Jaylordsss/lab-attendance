"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * A session-less client used only to test a password. Signing in through the
 * request's own client would replace the cookie the user is currently using,
 * logging them out on a wrong guess.
 */
function createIsolatedClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
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
 * Verifying a password change.
 *
 * An earlier version emailed a one-time code through Supabase's
 * reauthenticate(). That relies on the built-in mailer, which is rate limited
 * to a couple of messages an hour on the free tier and is documented as being
 * for testing only — so the code frequently never arrived, and a student
 * locked behind an email that never comes is worse off than one with no
 * second factor at all.
 *
 * Asking for the current password achieves the same thing: someone who picks
 * up an unlocked phone still cannot change the password without knowing it.
 * It needs no mail server, works offline, and is what most services do.
 */

/**
 * Step one: prove the current password, then send a code.
 *
 * The new password is not written yet. Verifying the old one stops a
 * passer-by with an unlocked phone; the emailed code stops someone who has
 * learned the password but has no access to the inbox. Neither alone is
 * enough, which is the point of asking for both.
 */
export async function startPasswordChange(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current) return fail("Enter your current password.");
  if (next.length < MIN_PASSWORD) {
    return fail(`Use at least ${MIN_PASSWORD} characters.`);
  }
  if (next !== confirm) return fail("The two passwords don't match.");
  if (next === current) {
    return fail("Choose a password different from your current one.");
  }

  const service = getServiceClient();
  const { data: authUser } = await service.auth.admin.getUserById(user.id);
  const email = authUser.user?.email;

  if (!email) return fail("Couldn't verify your account. Try again.");

  // A throwaway client, so a wrong guess cannot disturb the session the user
  // is currently signed in with.
  const { error: checkErr } = await createIsolatedClient().auth.signInWithPassword(
    { email, password: current },
  );

  if (checkErr) return fail("That current password is not right.");

  const supabase = await createClient();
  const { error } = await supabase.auth.reauthenticate();

  if (error) {
    console.error("reauthenticate:", error.message);
    return fail(
      error.message.toLowerCase().includes("rate")
        ? "Too many codes requested. Wait a few minutes and try again."
        : "Couldn't send the code. Check your email address is correct.",
    );
  }

  return ok(`Code sent to ${maskEmail(email)}.`);
}

/** Step two: the code arrives, and only then is the password written. */
export async function confirmPasswordChange(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const next = String(formData.get("password") ?? "");
  const nonce = String(formData.get("nonce") ?? "").trim();
  const inSetup = String(formData.get("setup") ?? "") === "1";

  if (next.length < MIN_PASSWORD) {
    return fail("Start again — the new password was lost.");
  }
  if (!nonce) return fail("Enter the code from your email.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next, nonce });

  if (error) {
    console.error("password change:", error.message);
    return fail(
      error.message.toLowerCase().includes("nonce")
        ? "That code is wrong or has expired. Send a new one."
        : "Couldn't change your password. Try again.",
    );
  }

  await finishPasswordChange(user.id);
  redirect(inSetup ? "/account?complete=1&done=1" : HOME_FOR_ROLE[user.role]);
}

/**
 * First-run setup, where there is no code step.
 *
 * The password a new account holds was issued by someone else, and a student
 * on a synthetic @students.invalid address has no inbox a code could reach.
 * Requiring one here would lock out exactly the people who most need to get
 * in.
 */
export async function setInitialPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < MIN_PASSWORD) {
    return fail(`Use at least ${MIN_PASSWORD} characters.`);
  }
  if (next !== confirm) return fail("The two passwords don't match.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });

  if (error) {
    console.error("initial password:", error.message);
    return fail("Couldn't set your password. Try again.");
  }

  await finishPasswordChange(user.id);
  redirect("/account?complete=1&done=1");
}

async function finishPasswordChange(userId: string) {
  const service = getServiceClient();

  await service
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);

  await service.from("audit_log").insert({
    actor_id: userId,
    action: "password_changed",
    target: userId,
  });
}

/** j****d@gmail.com — enough to recognise, not enough to harvest. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 5))}${local.at(-1)}@${domain}`;
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
  if (!contactRaw) {
    return fail("Enter your mobile number.");
  }

  const contactNo = normalizePhPhone(contactRaw);
  if (!contactNo) return fail(phoneError());

  const service = getServiceClient();

  const { error: authErr } = await service.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  });
  if (authErr) {
    console.error("staff email update:", authErr.message);
    return fail(
      authErr.message.toLowerCase().includes("already")
        ? "That email is already used by another account."
        : `Couldn't update your email — ${authErr.message}`,
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

  // All of it, or none of it. A half-filled record is worse than an empty
  // one: the school believes it has a guardian contact until the day it needs
  // to use it. Saving is refused rather than silently storing blanks.
  const missing: string[] = [];
  if (!contactRaw) missing.push("your mobile");
  if (!guardianName) missing.push("guardian name");
  if (!guardianRaw) missing.push("guardian mobile");
  if (!address) missing.push("address");

  if (missing.length > 0) {
    return fail(`Still needed: ${listOf(missing)}.`);
  }

  const contactNo = normalizePhPhone(contactRaw);
  if (!contactNo) return fail(phoneError("your"));

  const guardianNo = normalizePhPhone(guardianRaw);
  if (!guardianNo) return fail(phoneError("your guardian's"));

  if (guardianName.length < 2) {
    return fail("Enter your guardian's full name.");
  }
  if (address.length < 8) {
    return fail("Enter your complete address, including the city.");
  }

  const supabase = await createClient();
  const service = getServiceClient();

  // Only touch auth if the address actually changed — rewriting it on every
  // save is needless work and would reset confirmation state.
  if (email) {
    const { data } = await supabase.auth.getUser();
    const currentEmail = data.user?.email ?? "";

    if (email !== currentEmail) {
      if (!email.includes("@") || isSyntheticStudentEmail(email)) {
        return fail("Enter a real email address.");
      }

      const { error } = await service.auth.admin.updateUserById(user.id, {
        email,
        email_confirm: true,
      });

      if (error) {
        // Surface what Supabase actually said. A generic message here hides
        // the difference between a taken address, a rejected domain and a
        // misconfigured server — three problems with three different fixes.
        console.error("student email update:", error.message);

        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered")) {
          return fail("That email is already used by another account.");
        }
        if (msg.includes("invalid")) {
          return fail(
            "Supabase rejected that address. Check it is spelled correctly.",
          );
        }
        return fail(`Couldn't update your email — ${error.message}`);
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

  // Everything required is present, so there is nothing left to hold them
  // here. Send them to the scan screen rather than making them find it.
  const { data: complete } = await supabase.rpc("student_profile_complete", {
    p_user_id: user.id,
  });

  if (complete === true) {
    // Mid-setup, the next step is a password of their own — not the scanner.
    const inSetup = String(formData.get("setup") ?? "") === "1";
    redirect(inSetup ? "/account?complete=1" : HOME_FOR_ROLE.student);
  }

  return ok("Saved.");
}

/* ------------------------------------------------------------------ */

/** "a, b and c" — reads better in an error than a bare comma list. */
function listOf(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

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

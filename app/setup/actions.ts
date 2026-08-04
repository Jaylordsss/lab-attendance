"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { getServiceClient, adminExists } from "@/lib/supabase/admin";

export type SetupState = { error: string | null };

const MIN_PASSWORD = 12;

export async function createFirstAdmin(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  // --- Lock 1: the route closes permanently once an admin exists ----------
  if (await adminExists()) {
    return { error: "Setup is already complete. Sign in instead." };
  }

  // --- Lock 2: a setup key only the deployer knows ------------------------
  const expected = process.env.SETUP_KEY;
  if (!expected || expected.length < 16) {
    return {
      error:
        "SETUP_KEY is not configured on the server. Set it in .env.local before running setup.",
    };
  }
  if (!constantTimeEquals(String(formData.get("setupKey") ?? ""), expected)) {
    return { error: "That setup key is not correct." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Fill in every field." };
  }
  if (!email.includes("@") || email.endsWith("@students.invalid")) {
    return { error: "Use a real email address you can receive mail at." };
  }
  if (password.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters in your password.` };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match." };
  }

  const supabase = getServiceClient();

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no inbox round-trip for the very first account
  });

  if (createErr || !created.user) {
    return { error: "Couldn't create the account. Try a different email." };
  }

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: created.user.id,
    role: "admin",
    full_name: fullName,
  });

  if (profileErr) {
    // Roll back so a half-made account cannot block a retry.
    await supabase.auth.admin.deleteUser(created.user.id);
    return { error: "Couldn't finish setting up the account. Try again." };
  }

  await supabase.from("audit_log").insert({
    actor_id: created.user.id,
    action: "first_admin_created",
    target: created.user.id,
    detail: { email },
  });

  redirect("/login?setup=done");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

"use server";

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { HOME_FOR_ROLE } from "@/lib/auth";

export type ResetState = { error: string | null };

const MIN_PASSWORD = 8;

/**
 * Sets a new password for someone who arrived from a reset link.
 *
 * Clicking the link signs them in, so no current password is asked for — the
 * link itself is the proof, and demanding the old one would defeat the point
 * of a reset.
 */
export async function setNewPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: "That link has expired. Ask for a new one from the sign-in page.",
    };
  }

  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (next !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });

  if (error) {
    console.error("reset password:", error.message);
    return { error: "Couldn't set your password. Ask for a new link." };
  }

  const service = getServiceClient();
  await service
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  await service.from("audit_log").insert({
    actor_id: user.id,
    action: "password_reset_by_link",
    target: user.id,
  });

  redirect(HOME_FOR_ROLE[user.role]);
}

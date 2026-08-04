"use server";

import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { HOME_FOR_ROLE } from "@/lib/auth";

export type PasswordState = { error: string | null };

const MIN_PASSWORD = 8;

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < MIN_PASSWORD) {
    return { error: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (next !== confirm) {
    return { error: "The two passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: next });

  if (error) {
    return { error: "Couldn't change your password. Try again." };
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

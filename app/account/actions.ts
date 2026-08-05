"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { normalizePhPhone, HOME_FOR_ROLE } from "@/lib/auth";

export type PasswordState = { error: string | null };
export type ProfileState = { error: string | null; success: string | null };

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

  if (error) return { error: "Couldn't change your password. Try again." };

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

/**
 * Teachers and admins maintain their own email and mobile number.
 *
 * Deliberately not open to students: their address is synthetic
 * (@students.invalid) and changing it would break their sign-in, since the
 * login form derives it from their student number.
 */
export async function updateContact(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "student") {
    return { error: "Students can't change these details.", success: null };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const contactRaw = String(formData.get("contactNo") ?? "").trim();

  if (!email.includes("@") || email.endsWith("@students.invalid")) {
    return { error: "Enter a real email address.", success: null };
  }

  let contactNo: string | null = null;
  if (contactRaw) {
    contactNo = normalizePhPhone(contactRaw);
    if (!contactNo) {
      return {
        error:
          "Enter a Philippine mobile number, like 0917 123 4567 or +63 917 123 4567.",
        success: null,
      };
    }
  }

  const service = getServiceClient();

  const { error: authErr } = await service.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
  });

  if (authErr) {
    return {
      error: authErr.message.includes("already")
        ? "That email is already used by another account."
        : "Couldn't update your email.",
      success: null,
    };
  }

  const { error: staffErr } = await service
    .from("staff")
    .update({ contact_no: contactNo })
    .eq("user_id", user.id);

  if (staffErr) {
    return { error: "Couldn't save your mobile number.", success: null };
  }

  await service.from("audit_log").insert({
    actor_id: user.id,
    action: "contact_updated",
    target: user.id,
    detail: { email },
  });

  revalidatePath("/account");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/users");
  return { error: null, success: "Saved." };
}

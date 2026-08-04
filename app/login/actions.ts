"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  studentNoToEmail,
  normalizeFacultyId,
  HOME_FOR_ROLE,
  type Role,
} from "@/lib/auth";

export type LoginState = { error: string | null };

/**
 * Resolves whatever the person typed into the email Supabase Auth expects.
 *
 * Three accepted forms, checked in this order:
 *   1. Anything containing an @ is already an email.
 *   2. A faculty ID belonging to a staff member.
 *   3. Otherwise a student number, mapped to its synthetic address.
 *
 * The faculty lookup runs through the service client rather than a database
 * function, so nothing that maps ID numbers to email addresses is reachable
 * by an unauthenticated caller.
 */
async function resolveEmail(identifier: string): Promise<string> {
  const value = identifier.trim();
  if (!value) return "";
  if (value.includes("@")) return value.toLowerCase();

  const facultyId = normalizeFacultyId(value);
  const service = getServiceClient();

  const { data: staff } = await service
    .from("staff")
    .select("user_id")
    .ilike("faculty_id", facultyId)
    .maybeSingle();

  if (staff) {
    const { data } = await service.auth.admin.getUserById(
      staff.user_id as string,
    );
    if (data.user?.email) return data.user.email;
  }

  return studentNoToEmail(value);
}

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Enter your ID number and password." };
  }

  const email = await resolveEmail(identifier);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // One message for every failure mode. Distinguishing "no such account" from
  // "wrong password" would let anyone enumerate valid ID numbers.
  if (error || !data.user) {
    return { error: "That ID number and password don't match." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account isn't set up yet. Ask your teacher." };
  }

  // Anyone still on an issued password chooses their own before going further.
  if (profile.must_change_password) redirect("/account");

  redirect(HOME_FOR_ROLE[profile.role as Role] ?? "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

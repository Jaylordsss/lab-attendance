"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { identifierToEmail, HOME_FOR_ROLE, type Role } from "@/lib/auth";

export type LoginState = { error: string | null };

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Enter your student number and password." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifierToEmail(identifier),
    password,
  });

  // One message for every failure mode. Distinguishing "no such account" from
  // "wrong password" would let anyone enumerate valid student numbers.
  if (error || !data.user) {
    return { error: "That student number and password don't match." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account isn't set up yet. Ask your teacher." };
  }

  redirect(HOME_FOR_ROLE[profile.role as Role] ?? "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

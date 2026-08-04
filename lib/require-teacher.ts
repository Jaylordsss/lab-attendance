import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

/** Teachers only. Admins are redirected to their own dashboard. */
export async function requireTeacher() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");
  return user;
}

/** The PII encryption key. Fails loudly rather than writing plaintext. */
export function piiKey(): string {
  const key = process.env.PII_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "PII_KEY is missing or too short. Set a 32+ character value in .env.local and in Vercel before enrolling students.",
    );
  }
  return key;
}

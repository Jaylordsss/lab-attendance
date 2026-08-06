"use server";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  normalizeStudentNo,
  normalizeFacultyId,
  isSyntheticStudentEmail,
} from "@/lib/auth";

export type ForgotState = { error: string | null; success: string | null };

/**
 * Sends a reset link.
 *
 * Accepts a student number, faculty ID or email — the same three forms the
 * login field takes, because someone who has forgotten their password will
 * type whatever they normally sign in with.
 */
export async function sendResetLink(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) {
    return { error: "Enter your ID number or email.", success: null };
  }

  const service = getServiceClient();
  let email: string | null = null;

  if (identifier.includes("@")) {
    email = identifier.toLowerCase();
  } else {
    const { data: staff } = await service
      .from("staff")
      .select("user_id")
      .ilike("faculty_id", normalizeFacultyId(identifier))
      .maybeSingle();

    let userId = staff?.user_id as string | undefined;

    if (!userId) {
      const { data: student } = await service
        .from("students")
        .select("user_id")
        .ilike("student_no", normalizeStudentNo(identifier))
        .maybeSingle();
      userId = student?.user_id as string | undefined;
    }

    if (userId) {
      const { data } = await service.auth.admin.getUserById(userId);
      email = data.user?.email ?? null;
    }
  }

  // An account still on a synthetic address has no inbox. Say so plainly —
  // sending someone away to wait for mail that cannot arrive is worse than
  // telling them to ask their teacher.
  if (email && isSyntheticStudentEmail(email)) {
    return {
      error:
        "This account has no email address yet, so a link can't be sent. Ask your teacher to reset it for you.",
      success: null,
    };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (email) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      console.error("reset link:", error.message);
      if (error.message.toLowerCase().includes("rate")) {
        return {
          error: "Too many requests. Wait a few minutes and try again.",
          success: null,
        };
      }
    }
  }

  // The same reply whether or not the account exists. Otherwise this page
  // becomes a way to discover which student numbers are real.
  return {
    error: null,
    success:
      "If that account has an email address, a reset link is on its way. Check your inbox and spam.",
  };
}

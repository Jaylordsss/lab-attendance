"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type SubjectState = { error: string | null; success: string | null };

export async function createSubject(
  _prev: SubjectState,
  formData: FormData,
): Promise<SubjectState> {
  const admin = await requireAdmin();

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();

  if (!code || !title) {
    return { error: "Give the subject a code and a title.", success: null };
  }
  if (!/^[A-Z0-9- ]{2,20}$/.test(code)) {
    return { error: "Code must be 2-20 letters, numbers, spaces or dashes.", success: null };
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from("subjects").insert({ code, title });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Subject ${code} already exists.`
          : "Couldn't save the subject. Try again.",
      success: null,
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "subject_created",
    target: code,
  });

  revalidatePath("/admin/subjects");
  revalidatePath("/admin/sections");
  return { error: null, success: `${code} added.` };
}

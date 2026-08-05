"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/require-teacher";

export type MarkState = { error: string | null; success: string | null };

/**
 * Marks a student by hand.
 *
 * Runs through the signed-in teacher's own client rather than the service
 * role, so the database function's permission check is doing real work: a
 * teacher can only touch sessions belonging to sections they teach, and that
 * is enforced in Postgres rather than here.
 */
export async function markAttendance(
  _prev: MarkState,
  formData: FormData,
): Promise<MarkState> {
  await requireTeacher();

  const sectionId = String(formData.get("sectionId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const name = String(formData.get("name") ?? "");

  if (!sessionId || !studentId || !status) {
    return { error: "Something was missing. Try again.", success: null };
  }
  if (reason.length < 10) {
    return {
      error: "Give a reason of at least 10 characters — it goes on the record.",
      success: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_attendance", {
    p_session_id: sessionId,
    p_student_id: studentId,
    p_status: status,
    p_reason: reason,
  });

  if (error) {
    return {
      error: error.message.includes("not permitted")
        ? "That isn't one of your sections."
        : "Couldn't save that. Try again.",
      success: null,
    };
  }

  revalidatePath(`/teacher/sections/${sectionId}`);
  return { error: null, success: `${name} marked ${status}.` };
}

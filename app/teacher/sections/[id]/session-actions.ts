"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";
import { newSecret } from "@/lib/qr-token";
import { startWindow } from "@/lib/schedule";

/**
 * The on/off switch.
 *
 * The room's QR code never changes. What changes is whether an open
 * class_session exists for that room — the scan endpoint refuses every code
 * when there isn't one. So "turning the QR on" is really "opening the class".
 */

/** Today's date in Manila, as YYYY-MM-DD. */
function manilaToday(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

async function ownedSection(sectionId: string, teacherId: string) {
  const { data } = await getServiceClient()
    .from("sections")
    .select("id, default_room_id, name, day_of_week, start_time, end_time")
    .eq("id", sectionId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return data;
}

export async function startSession(formData: FormData) {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId"));

  const section = await ownedSection(sectionId, teacher.id);
  if (!section?.default_room_id) return;

  // A class may only be opened on its own day, inside its own hours.
  // Attendance is only meaningful if it happens when the class does —
  // otherwise Monday's session could be opened on Thursday night and the
  // record would look identical to a real one.
  //
  // The panel disables the button for the same reason, but that is a
  // courtesy. This is the check that counts, because a form can be posted
  // directly.
  const window = startWindow({
    day_of_week: section.day_of_week as number,
    start_time: section.start_time as string,
    end_time: section.end_time as string,
  });

  if (!window.canStart) {
    await audit(teacher.id, `session_start_refused_${window.reason}`, sectionId);
    return;
  }

  const supabase = getServiceClient();
  const today = manilaToday();

  // One session per section per day. Reopening a closed one keeps the
  // attendance already recorded against it rather than starting a second.
  const { data: existing } = await supabase
    .from("class_sessions")
    .select("id, status")
    .eq("section_id", sectionId)
    .eq("session_date", today)
    .maybeSingle();

  if (existing) {
    if (existing.status === "closed") {
      await supabase
        .from("class_sessions")
        .update({ status: "open", closed_at: null })
        .eq("id", existing.id);
      await audit(teacher.id, "session_reopened", existing.id as string);
    }
  } else {
    const { error } = await supabase.from("class_sessions").insert({
      section_id: sectionId,
      room_id: section.default_room_id,
      qr_secret: newSecret(),
      session_date: today,
      status: "open",
    });

    // A unique index allows only one open session per room. If another class
    // is running there, this fails — which is the correct outcome.
    if (error) return;

    await audit(teacher.id, "session_opened", sectionId);
  }

  revalidatePath(`/teacher/sections/${sectionId}`);
}

export async function endSession(formData: FormData) {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId"));
  const sessionId = String(formData.get("sessionId"));

  if (!(await ownedSection(sectionId, teacher.id))) return;

  const supabase = getServiceClient();

  // Closes the session and sweeps every enrolled student who never scanned
  // into an absent row, atomically.
  await supabase.rpc("close_session", { sid: sessionId });
  await audit(teacher.id, "session_closed", sessionId);

  revalidatePath(`/teacher/sections/${sectionId}`);
}

async function audit(actorId: string, action: string, target: string) {
  await getServiceClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target });
}

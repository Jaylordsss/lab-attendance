"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type SectionState = { error: string | null; success: string | null };

export async function createSection(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const admin = await requireAdmin();

  const subjectId = str(formData, "subjectId");
  const teacherId = str(formData, "teacherId");
  const roomId = str(formData, "roomId");
  const name = str(formData, "name");
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = str(formData, "startTime");
  const endTime = str(formData, "endTime");
  const grace = Number(formData.get("grace") ?? 15);

  if (!subjectId || !teacherId || !roomId || !name || !startTime || !endTime) {
    return fail("Fill in every field.");
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return fail("Pick a day of the week.");
  }
  if (startTime >= endTime) {
    return fail("The end time must be after the start time.");
  }
  if (!Number.isFinite(grace) || grace < 0 || grace > 60) {
    return fail("Grace period must be between 0 and 60 minutes.");
  }

  const supabase = getServiceClient();

  // Two sections cannot occupy one laboratory at overlapping times on the same
  // weekday. The DB can't express this as a constraint without an exclusion
  // index, so check it here — a clash would silently break attendance for both.
  const { data: clashes } = await supabase
    .from("sections")
    .select("name, start_time, end_time")
    .eq("default_room_id", roomId)
    .eq("day_of_week", dayOfWeek)
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  if (clashes && clashes.length > 0) {
    return fail(
      `That laboratory is already booked then by ${clashes[0].name}.`,
    );
  }

  const { error } = await supabase.from("sections").insert({
    subject_id: subjectId,
    teacher_id: teacherId,
    default_room_id: roomId,
    name,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    grace_minutes: grace,
  });

  if (error) {
    return fail(
      error.code === "23505"
        ? `A section called ${name} already exists for that subject.`
        : "Couldn't save the section. Try again.",
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "section_created",
    target: name,
    detail: { day_of_week: dayOfWeek, start_time: startTime },
  });

  revalidatePath("/admin/sections");
  return { error: null, success: `${name} added.` };
}

function fail(error: string): SectionState {
  return { error, success: null };
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

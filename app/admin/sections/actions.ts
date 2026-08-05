"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type SectionState = { error: string | null; success: string | null };

const ok = (success: string): SectionState => ({ error: null, success });
const fail = (error: string): SectionState => ({ error, success: null });

function readForm(formData: FormData) {
  return {
    subjectId: str(formData, "subjectId"),
    teacherId: str(formData, "teacherId"),
    roomId: str(formData, "roomId"),
    name: str(formData, "name"),
    dayOfWeek: Number(formData.get("dayOfWeek")),
    startTime: str(formData, "startTime"),
    endTime: str(formData, "endTime"),
    grace: Number(formData.get("grace") ?? 15),
  };
}

function validate(v: ReturnType<typeof readForm>): string | null {
  if (!v.subjectId || !v.teacherId || !v.roomId || !v.name || !v.startTime || !v.endTime) {
    return "Fill in every field.";
  }
  if (!Number.isInteger(v.dayOfWeek) || v.dayOfWeek < 0 || v.dayOfWeek > 6) {
    return "Pick a day of the week.";
  }
  if (v.startTime >= v.endTime) return "The end time must be after the start time.";
  if (!Number.isFinite(v.grace) || v.grace < 0 || v.grace > 60) {
    return "Grace period must be between 0 and 60 minutes.";
  }
  return null;
}

/**
 * Two sections cannot occupy one laboratory at overlapping times on the same
 * weekday. Postgres cannot express this without an exclusion index, so it is
 * checked here — a clash would silently break attendance for both classes.
 */
async function clashesWith(
  v: ReturnType<typeof readForm>,
  excludeId?: string,
): Promise<string | null> {
  let query = getServiceClient()
    .from("sections")
    .select("name")
    .eq("default_room_id", v.roomId)
    .eq("day_of_week", v.dayOfWeek)
    .lt("start_time", v.endTime)
    .gt("end_time", v.startTime);

  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query;
  return data && data.length > 0
    ? `That laboratory is already booked then by ${data[0].name}.`
    : null;
}

export async function createSection(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const admin = await requireAdmin();
  const v = readForm(formData);

  const problem = validate(v) ?? (await clashesWith(v));
  if (problem) return fail(problem);

  const { error } = await getServiceClient().from("sections").insert({
    subject_id: v.subjectId,
    teacher_id: v.teacherId,
    default_room_id: v.roomId,
    name: v.name,
    day_of_week: v.dayOfWeek,
    start_time: v.startTime,
    end_time: v.endTime,
    grace_minutes: v.grace,
  });

  if (error) return fail(saveError(error, v.name));

  await audit(admin.id, "section_created", v.name, {
    day_of_week: v.dayOfWeek,
    start_time: v.startTime,
  });
  revalidatePath("/admin/sections");
  return ok(`${v.name} added.`);
}

export async function updateSection(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const v = readForm(formData);

  if (!id) return fail("Missing section.");

  const problem = validate(v) ?? (await clashesWith(v, id));
  if (problem) return fail(problem);

  const { error } = await getServiceClient()
    .from("sections")
    .update({
      subject_id: v.subjectId,
      teacher_id: v.teacherId,
      default_room_id: v.roomId,
      name: v.name,
      day_of_week: v.dayOfWeek,
      start_time: v.startTime,
      end_time: v.endTime,
      grace_minutes: v.grace,
    })
    .eq("id", id);

  if (error) return fail(saveError(error, v.name));

  await audit(admin.id, "section_updated", id, { name: v.name });
  revalidatePath("/admin/sections");
  revalidatePath(`/admin/sections/${id}`);
  return ok("Saved.");
}

export async function deleteSection(
  _prev: SectionState,
  formData: FormData,
): Promise<SectionState> {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id) return fail("Missing section.");

  const supabase = getServiceClient();

  // Deleting cascades to enrolments, sessions and attendance. A section that
  // has held a class is history, not a mistake, so it is refused.
  const { count } = await supabase
    .from("class_sessions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", id);

  if ((count ?? 0) > 0) {
    return fail(
      `${name} has attendance history and can't be deleted. Reassign its teacher instead.`,
    );
  }

  const { error } = await supabase.from("sections").delete().eq("id", id);
  if (error) return fail("Couldn't delete the section.");

  await audit(admin.id, "section_deleted", name, {});
  revalidatePath("/admin/sections");
  return ok(`${name} deleted.`);
}

function saveError(error: { code?: string }, name: string): string {
  if (error.code === "23505") {
    return `A section called ${name} already exists for that subject.`;
  }
  return "Couldn't save the section. Check the teacher is a teacher and try again.";
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

async function audit(
  actorId: string,
  action: string,
  target: string,
  detail: Record<string, unknown>,
) {
  await getServiceClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target, detail });
}

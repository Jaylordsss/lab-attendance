"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";
import { normalizeStudentNo } from "@/lib/auth";

export type NumberPlan = {
  studentNo: string;
  fullName: string;
  action: "enrol" | "skip" | "missing" | "duplicate";
  note: string;
};

export type NumberState = {
  error: string | null;
  plan: NumberPlan[] | null;
  numbers: string | null;
  summary: string | null;
};

const blank: NumberState = {
  error: null,
  plan: null,
  numbers: null,
  summary: null,
};

/**
 * Pulls student numbers out of whatever was pasted.
 *
 * People paste a column from Excel, a comma-separated line, or a list with
 * blank rows between groups. Splitting on anything that is not part of a
 * number handles all three without asking them to tidy it first.
 */
function extractNumbers(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => normalizeStudentNo(s))
    .filter(Boolean);
}

async function ownsSection(sectionId: string, teacherId: string) {
  const { data } = await getServiceClient()
    .from("sections")
    .select("id")
    .eq("id", sectionId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Says what a list of numbers would do, without doing it.
 *
 * This path never creates an account. It is for students the school has
 * already registered — most of a teacher's roster, most terms — where the
 * only fact needed is which class they are in.
 */
export async function previewNumbers(
  _prev: NumberState,
  formData: FormData,
): Promise<NumberState> {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId") ?? "");
  const numbers = String(formData.get("numbers") ?? "");

  if (!(await ownsSection(sectionId, teacher.id))) {
    return { ...blank, error: "That isn't one of your sections." };
  }

  const list = extractNumbers(numbers);
  if (list.length === 0) {
    return { ...blank, error: "Paste at least one student number." };
  }

  const supabase = getServiceClient();

  const { data: studentRows } = await supabase
    .from("students")
    .select("user_id, student_no");

  const known = new Map(
    ((studentRows ?? []) as { user_id: string; student_no: string }[]).map(
      (s) => [s.student_no.toUpperCase(), s.user_id],
    ),
  );

  const { data: nameRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "student");

  const names = new Map(
    ((nameRows ?? []) as { id: string; full_name: string }[]).map((p) => [
      p.id,
      p.full_name,
    ]),
  );

  const { data: enrolledRows } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("section_id", sectionId);

  const enrolled = new Set(
    ((enrolledRows ?? []) as { student_id: string }[]).map((e) => e.student_id),
  );

  const seen = new Set<string>();
  const plan: NumberPlan[] = [];

  for (const studentNo of list) {
    if (seen.has(studentNo)) {
      plan.push({
        studentNo,
        fullName: "—",
        action: "duplicate",
        note: "Listed twice",
      });
      continue;
    }
    seen.add(studentNo);

    const userId = known.get(studentNo);

    if (!userId) {
      plan.push({
        studentNo,
        fullName: "—",
        action: "missing",
        note: "No account with this number",
      });
      continue;
    }

    plan.push({
      studentNo,
      fullName: names.get(userId) ?? "—",
      action: enrolled.has(userId) ? "skip" : "enrol",
      note: enrolled.has(userId) ? "Already in this section" : "Will be added",
    });
  }

  return { ...blank, plan, numbers };
}

export async function confirmNumbers(
  _prev: NumberState,
  formData: FormData,
): Promise<NumberState> {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId") ?? "");
  const numbers = String(formData.get("numbers") ?? "");

  if (!(await ownsSection(sectionId, teacher.id))) {
    return { ...blank, error: "That isn't one of your sections." };
  }

  const supabase = getServiceClient();
  const list = [...new Set(extractNumbers(numbers))];

  const { data: studentRows } = await supabase
    .from("students")
    .select("user_id, student_no");

  const known = new Map(
    ((studentRows ?? []) as { user_id: string; student_no: string }[]).map(
      (s) => [s.student_no.toUpperCase(), s.user_id],
    ),
  );

  // One insert for the whole list. ignoreDuplicates lets a number already on
  // the roster pass through quietly rather than aborting the rest.
  const rows = list
    .map((no) => known.get(no))
    .filter((id): id is string => Boolean(id))
    .map((student_id) => ({ section_id: sectionId, student_id }));

  const notFound = list.length - rows.length;

  if (rows.length === 0) {
    return {
      ...blank,
      error: "None of those numbers matched a student account.",
    };
  }

  const { error, count } = await supabase
    .from("enrollments")
    .upsert(rows, { onConflict: "section_id,student_id", ignoreDuplicates: true, count: "exact" });

  if (error) {
    console.error("bulk enrol:", error.message);
    return { ...blank, error: "Couldn't enrol those students. Try again." };
  }

  await supabase.from("audit_log").insert({
    actor_id: teacher.id,
    action: "roster_enrolled_by_number",
    target: sectionId,
    detail: { requested: list.length, enrolled: count ?? 0 },
  });

  revalidatePath(`/teacher/sections/${sectionId}`);

  const parts = [
    `${count ?? 0} enrolled`,
    rows.length - (count ?? 0) > 0
      ? `${rows.length - (count ?? 0)} already in the section`
      : null,
    notFound ? `${notFound} had no account` : null,
  ].filter(Boolean);

  return { ...blank, summary: parts.join(" · ") };
}

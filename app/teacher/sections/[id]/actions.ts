"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher, piiKey } from "@/lib/require-teacher";
import { normalizeStudentNo, studentNoToEmail } from "@/lib/auth";

export type EnrolState = {
  error: string | null;
  created: { name: string; studentNo: string; tempPassword: string } | null;
  info: string | null;
};

const ok = (info: string): EnrolState => ({ error: null, created: null, info });
const fail = (error: string): EnrolState => ({ error, created: null, info: null });

/** Confirms the signed-in teacher actually owns this section. */
async function assertOwnsSection(sectionId: string, teacherId: string) {
  const { data } = await getServiceClient()
    .from("sections")
    .select("id")
    .eq("id", sectionId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return Boolean(data);
}

export async function enrolStudent(
  _prev: EnrolState,
  formData: FormData,
): Promise<EnrolState> {
  const teacher = await requireTeacher();

  const sectionId = str(formData, "sectionId");
  if (!(await assertOwnsSection(sectionId, teacher.id))) {
    return fail("That isn't one of your sections.");
  }

  const studentNo = normalizeStudentNo(str(formData, "studentNo"));
  if (!studentNo) return fail("Enter a student number.");

  const supabase = getServiceClient();

  // Already has an account? Just add the enrolment row.
  const { data: existing } = await supabase
    .from("students")
    .select("user_id, student_no")
    .ilike("student_no", studentNo)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("enrollments").insert({
      section_id: sectionId,
      student_id: existing.user_id,
    });

    if (error) {
      return error.code === "23505"
        ? fail("That student is already in this section.")
        : fail("Couldn't enrol that student. Try again.");
    }

    await audit(teacher.id, "student_enrolled", sectionId, { studentNo });
    revalidatePath(`/teacher/sections/${sectionId}`);
    return ok(`${studentNo} enrolled.`);
  }

  // New student — needs an account first.
  const fullName = str(formData, "fullName");
  const birthdate = str(formData, "birthdate");
  const address = str(formData, "address");
  const guardianName = str(formData, "guardianName");
  const guardianNo = str(formData, "guardianNo");

  if (!fullName || !birthdate || !guardianName || !guardianNo) {
    return fail(
      "That student number is new. Fill in name, birthday and guardian details to create the account.",
    );
  }
  if (Number.isNaN(Date.parse(birthdate))) {
    return fail("Enter a valid birthday.");
  }

  const tempPassword = randomBytes(6).toString("base64url");

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: studentNoToEmail(studentNo),
    password: tempPassword,
    email_confirm: true,
  });

  if (createErr || !created.user) {
    return fail("Couldn't create the account. That student number may be taken.");
  }

  const userId = created.user.id;

  const { error: profileErr } = await supabase
    .from("profiles")
    .insert({ id: userId, role: "student", full_name: fullName });

  if (profileErr) {
    await supabase.auth.admin.deleteUser(userId);
    return fail("Couldn't create the student's profile. Try again.");
  }

  // Guardian details and address are encrypted inside this function. They never
  // exist as plaintext columns.
  const { error: recordErr } = await supabase.rpc("create_student_record", {
    p_user_id: userId,
    p_student_no: studentNo,
    p_birthdate: birthdate,
    p_address: address,
    p_guardian_name: guardianName,
    p_guardian_no: guardianNo,
    p_key: piiKey(),
  });

  if (recordErr) {
    await supabase.auth.admin.deleteUser(userId);
    return fail("Couldn't save the student's details. Try again.");
  }

  const { error: enrolErr } = await supabase
    .from("enrollments")
    .insert({ section_id: sectionId, student_id: userId });

  if (enrolErr) {
    await supabase.auth.admin.deleteUser(userId);
    return fail("Couldn't enrol the student. Try again.");
  }

  await audit(teacher.id, "student_created", userId, { studentNo });
  revalidatePath(`/teacher/sections/${sectionId}`);

  return {
    error: null,
    info: null,
    created: { name: fullName, studentNo, tempPassword },
  };
}

export async function removeStudent(formData: FormData) {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId"));
  const studentId = String(formData.get("studentId"));

  if (!(await assertOwnsSection(sectionId, teacher.id))) return;

  const supabase = getServiceClient();

  // Removes them from this section only. The account and any attendance
  // history stay — dropping a class is not the same as never having attended.
  await supabase
    .from("enrollments")
    .delete()
    .eq("section_id", sectionId)
    .eq("student_id", studentId);

  await audit(teacher.id, "student_unenrolled", sectionId, { studentId });
  revalidatePath(`/teacher/sections/${sectionId}`);
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

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

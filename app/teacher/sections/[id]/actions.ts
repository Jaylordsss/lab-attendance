"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher, piiKey } from "@/lib/require-teacher";
import { normalizeStudentNo, normalizePhPhone } from "@/lib/auth";

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
  const department = str(formData, "department");
  const email = str(formData, "email").toLowerCase();
  const address = str(formData, "address");
  const guardianName = str(formData, "guardianName");
  const guardianNo = str(formData, "guardianNo");
  const contactRaw = str(formData, "contactNo");

  // Every field, because each one is load-bearing: the email is the only way
  // a student recovers their own password, the mobile is what the school rings
  // when something happens in a laboratory, and the department is what the
  // headcounts are built from. A blank here becomes someone's problem months
  // later, when it is far more expensive to fill in.
  const missing: string[] = [];
  if (!fullName) missing.push("full name");
  if (!birthdate) missing.push("birthday");
  if (!department) missing.push("department");
  if (!email) missing.push("email address");
  if (!contactRaw) missing.push("student mobile");
  if (!address) missing.push("address");
  if (!guardianName) missing.push("guardian name");
  if (!guardianNo) missing.push("guardian mobile");

  if (missing.length) {
    return fail(`That student number is new. Still needed: ${listOf(missing)}.`);
  }
  if (Number.isNaN(Date.parse(birthdate))) {
    return fail("Enter a valid birthday.");
  }

  if (!email.includes("@") || email.endsWith("@students.invalid")) {
    return fail("Enter a real email address they can receive mail at.");
  }

  const contactNo = normalizePhPhone(contactRaw);
  if (!contactNo) {
    return fail("Enter the student's Philippine mobile number.");
  }

  const tempPassword = randomBytes(6).toString("base64url");

  // The student still signs in with their number — the login resolves the
  // number to the account rather than deriving an address — but a real inbox
  // means they can recover a forgotten password without finding a teacher.
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createErr || !created.user) {
    return fail(
      createErr?.message.toLowerCase().includes("already")
        ? "That email is already used by another account."
        : "Couldn't create the account. That student number may be taken.",
    );
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
    p_department: department,
    p_contact_no: contactNo,
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

/**
 * Empties a section's roster in one go.
 *
 * Needed at the start of a term, when last year's list is still attached and
 * removing forty students one at a time is forty confirmations. Attendance
 * history survives — an enrolment row is a statement about the present, not a
 * record of what happened.
 */
export async function removeAllStudents(
  _prev: EnrolState,
  formData: FormData,
): Promise<EnrolState> {
  const teacher = await requireTeacher();
  const sectionId = str(formData, "sectionId");
  const confirmation = str(formData, "confirm");

  if (!(await assertOwnsSection(sectionId, teacher.id))) {
    return fail("That isn't one of your sections.");
  }

  // Typing the word is the guard. A button this destructive should not be
  // reachable by a mis-tap, and a section emptied by accident cannot be
  // undone from here.
  if (confirmation.toUpperCase() !== "REMOVE ALL") {
    return fail('Type REMOVE ALL exactly to confirm.');
  }

  const supabase = getServiceClient();

  const { count } = await supabase
    .from("enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("section_id", sectionId);

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("section_id", sectionId);

  if (error) return fail("Couldn't empty the roster. Try again.");

  await audit(teacher.id, "roster_cleared", sectionId, { removed: count ?? 0 });
  revalidatePath(`/teacher/sections/${sectionId}`);

  return ok(
    `${count ?? 0} student${count === 1 ? "" : "s"} removed from this section.`,
  );
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

/** "a, b and c" — reads better in an error than a bare comma list. */
function listOf(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

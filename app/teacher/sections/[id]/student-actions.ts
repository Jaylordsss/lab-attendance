"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";

export type StudentActionState = {
  error: string | null;
  success: string | null;
  password: string | null;
};

const ok = (success: string): StudentActionState => ({
  error: null,
  success,
  password: null,
});
const fail = (error: string): StudentActionState => ({
  error,
  success: null,
  password: null,
});

/** Confirms the student is in one of this teacher's sections. */
async function teachesStudent(studentId: string, teacherId: string) {
  const { data } = await getServiceClient()
    .from("enrollments")
    .select("section_id, sections!inner(teacher_id)")
    .eq("student_id", studentId)
    .eq("sections.teacher_id", teacherId)
    .limit(1);

  return Boolean(data && data.length > 0);
}

/**
 * Issues a new password for a student and shows it once.
 *
 * Students have no inbox, so an emailed reset cannot reach them — a teacher
 * reading out a new password is the only route back in, and making them go
 * through the office for it turns a thirty-second fix into a lost lesson.
 */
export async function resetStudentPassword(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const teacher = await requireTeacher();

  const studentId = String(formData.get("studentId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!studentId) return fail("Missing student.");
  if (!(await teachesStudent(studentId, teacher.id))) {
    return fail("That student isn't in one of your sections.");
  }

  const password = randomBytes(6).toString("base64url");
  const service = getServiceClient();

  const { error } = await service.auth.admin.updateUserById(studentId, {
    password,
  });

  if (error) {
    console.error("teacher password reset:", error.message);
    return fail("Couldn't reset that password. Try again.");
  }

  await service
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", studentId);

  await service.from("audit_log").insert({
    actor_id: teacher.id,
    action: "student_password_reset_by_teacher",
    target: studentId,
  });

  revalidatePath(`/teacher/sections/${sectionId}`);
  return { error: null, success: name, password };
}

/** Lets a student scan from a new phone. */
export async function unbindStudentDevice(
  _prev: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  await requireTeacher();

  const studentId = String(formData.get("studentId") ?? "");
  const sectionId = String(formData.get("sectionId") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!studentId) return fail("Missing student.");

  // The database function repeats the ownership check, so a forged request
  // fails there rather than relying on this code remembering to ask.
  const supabase = await createClient();
  const { error } = await supabase.rpc("unbind_student_device", {
    p_student_id: studentId,
  });

  if (error) {
    return fail(
      error.message.includes("not permitted")
        ? "That student isn't in one of your sections."
        : "Couldn't unbind that phone.",
    );
  }

  revalidatePath(`/teacher/sections/${sectionId}`);
  return ok(`${name} can now scan from a new phone.`);
}

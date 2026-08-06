"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";
import { normalizeStudentNo } from "@/lib/auth";

export type Found = {
  student_id: string;
  student_no: string;
  full_name: string;
  section_names: string;
  device_bound: boolean;
  needs_password: boolean;
};

export type SearchState = {
  error: string | null;
  student: Found | null;
  password: string | null;
  message: string | null;
};

const empty: SearchState = {
  error: null,
  student: null,
  password: null,
  message: null,
};

export async function findStudent(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  await requireTeacher();

  const studentNo = normalizeStudentNo(
    String(formData.get("studentNo") ?? ""),
  );

  if (!studentNo) {
    return { ...empty, error: "Enter a student number." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("teacher_find_student", {
    p_student_no: studentNo,
  });

  if (error) {
    console.error("teacher_find_student:", error.message);
    return { ...empty, error: "Couldn't search just now. Try again." };
  }

  const student = ((data ?? []) as Found[])[0];

  if (!student) {
    return {
      ...empty,
      error: `No student with number ${studentNo} in your sections.`,
    };
  }

  return { ...empty, student };
}

/**
 * Issues a new random password and shows it once.
 *
 * The teacher does not choose it. A password someone picks for another person
 * tends to be guessable and reused, and this one only has to survive until
 * the student sets their own at next sign-in.
 */
export async function resetPassword(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  const teacher = await requireTeacher();

  const studentId = String(formData.get("studentId") ?? "");
  const studentNo = String(formData.get("studentNo") ?? "");
  const name = String(formData.get("name") ?? "");

  if (!(await teaches(studentNo))) {
    return { ...empty, error: "That student isn't in one of your sections." };
  }

  const password = randomBytes(6).toString("base64url");
  const service = getServiceClient();

  const { error } = await service.auth.admin.updateUserById(studentId, {
    password,
  });

  if (error) {
    console.error("teacher password reset:", error.message);
    return { ...empty, error: "Couldn't reset that password. Try again." };
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

  return { ...empty, password, message: name };
}

export async function unbindDevice(
  _prev: SearchState,
  formData: FormData,
): Promise<SearchState> {
  await requireTeacher();

  const studentId = String(formData.get("studentId") ?? "");
  const name = String(formData.get("name") ?? "");

  // The database function repeats the ownership check, so a forged request
  // fails there rather than relying on this code remembering to ask.
  const supabase = await createClient();
  const { error } = await supabase.rpc("unbind_student_device", {
    p_student_id: studentId,
  });

  if (error) {
    return {
      ...empty,
      error: error.message.includes("not permitted")
        ? "That student isn't in one of your sections."
        : "Couldn't unbind that phone.",
    };
  }

  return {
    ...empty,
    message: `${name} can now scan from a new phone.`,
  };
}

/** Re-checks ownership at the moment of the change, not just at search time. */
async function teaches(studentNo: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("teacher_find_student", {
    p_student_no: studentNo,
  });
  return Boolean(data && (data as unknown[]).length > 0);
}

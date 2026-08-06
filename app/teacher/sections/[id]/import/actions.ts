"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher, piiKey } from "@/lib/require-teacher";
import { normalizeStudentNo, normalizePhPhone } from "@/lib/auth";
import { parseCsv, pick, parseDate } from "@/lib/csv";

export type RowPlan = {
  line: number;
  studentNo: string;
  fullName: string;
  action: "create" | "enrol" | "skip" | "error";
  note: string;
};

export type ImportState = {
  error: string | null;
  plan: RowPlan[] | null;
  csv: string | null;
  created: { studentNo: string; fullName: string; password: string }[] | null;
  summary: string | null;
};

const blank: ImportState = {
  error: null,
  plan: null,
  csv: null,
  created: null,
  summary: null,
};

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
 * Reads the file and says what it would do — without doing any of it.
 *
 * A roster of forty is checked in one pass rather than discovered row by row
 * halfway through an import. Nothing is written until the teacher has seen
 * this and pressed confirm.
 */
export async function previewImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId") ?? "");
  const csv = String(formData.get("csv") ?? "");

  if (!(await ownsSection(sectionId, teacher.id))) {
    return { ...blank, error: "That isn't one of your sections." };
  }
  if (!csv.trim()) {
    return { ...blank, error: "Paste the roster or choose a file first." };
  }

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return {
      ...blank,
      error:
        "Couldn't read that. The first line must be column names, with student_no and full_name among them.",
    };
  }

  const supabase = getServiceClient();

  const { data: existingRows } = await supabase
    .from("students")
    .select("user_id, student_no");

  const existing = new Map(
    ((existingRows ?? []) as { user_id: string; student_no: string }[]).map(
      (s) => [s.student_no.toUpperCase(), s.user_id],
    ),
  );

  const { data: enrolledRows } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("section_id", sectionId);

  const enrolled = new Set(
    ((enrolledRows ?? []) as { student_id: string }[]).map((e) => e.student_id),
  );

  const seen = new Set<string>();
  const plan: RowPlan[] = [];

  // Addresses already in use, so a clash is reported in the preview instead
  // of failing partway through the write.
  const { data: authUsers } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  const emails = new Set(
    (authUsers?.users ?? [])
      .map((u) => (u.email ?? "").toLowerCase())
      .filter((e) => e && !e.endsWith("@students.invalid")),
  );

  rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const studentNo = normalizeStudentNo(pick(row, "student_no"));
    const fullName = pick(row, "full_name");

    if (!studentNo) {
      plan.push({
        line,
        studentNo: "—",
        fullName: fullName || "—",
        action: "error",
        note: "No student number",
      });
      return;
    }

    if (seen.has(studentNo)) {
      plan.push({
        line,
        studentNo,
        fullName,
        action: "error",
        note: "Appears twice in this file",
      });
      return;
    }
    seen.add(studentNo);

    const userId = existing.get(studentNo);

    if (userId) {
      plan.push({
        line,
        studentNo,
        fullName,
        action: enrolled.has(userId) ? "skip" : "enrol",
        note: enrolled.has(userId)
          ? "Already in this section"
          : "Has an account — will be added",
      });
      return;
    }

    // Every column, because each one is load-bearing: the email is the only
    // way a student recovers their own password, the mobile is what the school
    // rings when something happens in a laboratory, and the department is what
    // the headcounts are built from. A blank imported today becomes someone's
    // problem months from now, when it is far more expensive to fill in.
    const missing: string[] = [];
    if (!fullName) missing.push("name");
    if (!parseDate(pick(row, "birthdate"))) missing.push("birthday");
    if (!pick(row, "department")) missing.push("department");
    if (!pick(row, "email")) missing.push("email");
    if (!normalizePhPhone(pick(row, "contact_no"))) {
      missing.push("student mobile");
    }
    if (!pick(row, "address")) missing.push("address");
    if (!pick(row, "guardian_name")) missing.push("guardian name");
    if (!normalizePhPhone(pick(row, "guardian_phone"))) {
      missing.push("guardian mobile");
    }

    // An address already taken would fail at creation, so it is caught here
    // rather than after thirty rows have been written.
    const email = pick(row, "email").trim().toLowerCase();

    if (email && !email.includes("@")) {
      plan.push({
        line,
        studentNo,
        fullName,
        action: "error",
        note: `"${email}" is not an email address`,
      });
      return;
    }

    if (email && emails.has(email)) {
      plan.push({
        line,
        studentNo,
        fullName,
        action: "error",
        note: "That email is already used by another account",
      });
      return;
    }
    if (email) emails.add(email);

    plan.push({
      line,
      studentNo,
      fullName: fullName || "—",
      action: missing.length ? "error" : "create",
      note: missing.length
        ? `Missing ${missing.join(", ")}`
        : `New account — ${email}`,
    });
  });

  return { ...blank, plan, csv };
}

/**
 * Writes the rows the preview approved, and skips the rest.
 *
 * Each student is created independently: one bad row leaves the other
 * thirty-nine enrolled rather than rolling back an afternoon's work.
 */
export async function confirmImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const teacher = await requireTeacher();
  const sectionId = String(formData.get("sectionId") ?? "");
  const csv = String(formData.get("csv") ?? "");

  if (!(await ownsSection(sectionId, teacher.id))) {
    return { ...blank, error: "That isn't one of your sections." };
  }

  const supabase = getServiceClient();
  const rows = parseCsv(csv);

  const created: ImportState["created"] = [];
  let enrolledCount = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const studentNo = normalizeStudentNo(pick(row, "student_no"));
    if (!studentNo) continue;

    const { data: found } = await supabase
      .from("students")
      .select("user_id")
      .ilike("student_no", studentNo)
      .maybeSingle();

    let userId = found?.user_id as string | undefined;

    if (!userId) {
      const fullName = pick(row, "full_name");
      const birthdate = parseDate(pick(row, "birthdate"));
      const guardianName = pick(row, "guardian_name");
      const guardianNo = normalizePhPhone(pick(row, "guardian_phone"));
      const address = pick(row, "address");
      const department = pick(row, "department");
      const contactNo = normalizePhPhone(pick(row, "contact_no"));
      const email = pick(row, "email").trim().toLowerCase();

      if (
        !fullName ||
        !birthdate ||
        !department ||
        !contactNo ||
        !address ||
        !guardianName ||
        !guardianNo ||
        !email.includes("@") ||
        email.endsWith("@students.invalid")
      ) {
        failed++;
        continue;
      }

      const password = randomBytes(6).toString("base64url");

      const { data: authUser, error: authErr } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authErr || !authUser.user) {
        failed++;
        continue;
      }

      userId = authUser.user.id;

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: userId,
        role: "student",
        full_name: fullName,
      });

      if (profileErr) {
        await supabase.auth.admin.deleteUser(userId);
        failed++;
        continue;
      }

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
        failed++;
        continue;
      }

      created.push({ studentNo, fullName, password });
    }

    const { error: enrolErr } = await supabase
      .from("enrollments")
      .insert({ section_id: sectionId, student_id: userId });

    if (enrolErr) {
      // 23505 is the unique constraint: already in this section, not a failure.
      if (enrolErr.code === "23505") skipped++;
      else failed++;
      continue;
    }

    enrolledCount++;
  }

  await supabase.from("audit_log").insert({
    actor_id: teacher.id,
    action: "roster_imported",
    target: sectionId,
    detail: { created: created.length, enrolled: enrolledCount, failed },
  });

  revalidatePath(`/teacher/sections/${sectionId}`);

  const parts = [
    `${enrolledCount} enrolled`,
    created.length ? `${created.length} new account${created.length === 1 ? "" : "s"}` : null,
    skipped ? `${skipped} already in the section` : null,
    failed ? `${failed} could not be imported` : null,
  ].filter(Boolean);

  return {
    ...blank,
    created: created.length ? created : null,
    summary: parts.join(" · "),
  };
}

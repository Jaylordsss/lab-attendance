/**
 * Student-number authentication.
 *
 * Supabase Auth requires an email address, but students here identify by
 * student number. We synthesise an address in the `.invalid` TLD, which RFC
 * 2606 reserves precisely so it can never resolve — no mail can ever be
 * delivered to it, accidentally or otherwise.
 *
 * Consequence worth knowing up front: students cannot self-serve a password
 * reset, because there is no inbox. Password resets for students go through an
 * admin action that sets a temporary password. Teachers and admins use real
 * email and reset normally.
 */

export const STUDENT_EMAIL_DOMAIN = "students.invalid";

/** Student numbers are case- and space-insensitive. `2024-00123` is canonical. */
export function normalizeStudentNo(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function studentNoToEmail(studentNo: string): string {
  return `${normalizeStudentNo(studentNo).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

export function emailToStudentNo(email: string): string | null {
  const [local, domain] = email.split("@");
  if (domain !== STUDENT_EMAIL_DOMAIN) return null;
  return local.toUpperCase();
}

export function isSyntheticStudentEmail(email: string): boolean {
  return email.endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

/**
 * One login field for everyone. If it contains an @ we treat it as a real
 * email (teacher or admin); otherwise it is a student number.
 */
export function identifierToEmail(identifier: string): string {
  const value = identifier.trim();
  return value.includes("@")
    ? value.toLowerCase()
    : studentNoToEmail(value);
}

/**
 * Format guard for the admin CSV importer. Adjust the pattern to match your
 * school's actual format — catching a malformed number here is much cheaper
 * than discovering an orphaned account three weeks into the term.
 */
export const STUDENT_NO_PATTERN = /^[0-9]{4}-[0-9]{5}$/;

export function isValidStudentNo(raw: string): boolean {
  return STUDENT_NO_PATTERN.test(normalizeStudentNo(raw));
}

export type Role = "admin" | "teacher" | "student";

export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

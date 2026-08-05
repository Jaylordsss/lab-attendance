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
  return value.includes("@") ? value.toLowerCase() : studentNoToEmail(value);
}

export const STUDENT_NO_PATTERN = /^[0-9]{4}-[0-9]{5}$/;

export function isValidStudentNo(raw: string): boolean {
  return STUDENT_NO_PATTERN.test(normalizeStudentNo(raw));
}

/* ------------------------------------------------------------------ *
 * Staff
 * ------------------------------------------------------------------ */

/** Faculty IDs are stored uppercase so lookups are predictable. */
export function normalizeFacultyId(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Deliberately permissive — schools number their faculty in wildly different
 * ways and rejecting a valid ID is worse than accepting an odd one.
 */
export const FACULTY_ID_PATTERN = /^[A-Z0-9-]{3,20}$/;

export function isValidFacultyId(raw: string): boolean {
  return FACULTY_ID_PATTERN.test(normalizeFacultyId(raw));
}

/* ------------------------------------------------------------------ *
 * Philippine mobile numbers
 * ------------------------------------------------------------------ */

/**
 * Stored canonically as +639XXXXXXXXX.
 *
 * People write the same number four ways — 0917…, +63917…, 63917…, or with
 * spaces and dashes. Normalising on the way in means a search for a guardian's
 * number finds them however it was typed, and an SMS gateway can be pointed at
 * the column later without a migration.
 *
 * Philippine mobile numbers are always 9 followed by nine more digits.
 */
export function normalizePhPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;

  let local: string;

  if (digits.startsWith("+63")) local = digits.slice(3);
  else if (digits.startsWith("63")) local = digits.slice(2);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;

  // A valid mobile subscriber number is 9 plus nine digits.
  if (!/^9\d{9}$/.test(local)) return null;

  return `+63${local}`;
}

export function isValidPhPhone(raw: string): boolean {
  return normalizePhPhone(raw) !== null;
}

/** +639171234567 → 0917 123 4567. For display where there is no +63 prefix. */
export function formatPhPhone(stored: string): string {
  const national = toNationalDigits(stored);
  if (!national) return stored;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/**
 * +639171234567 → 9171234567.
 *
 * For inputs that already show a fixed +63 prefix. Keeping the leading zero
 * there renders as "+63 0917…", which is not a real number in any format and
 * invites people to add or drop a digit to make it look right.
 *
 * Falls back to salvaging whatever digits it can, so a number stored before
 * normalisation existed still appears in the field rather than vanishing.
 */
export function toNationalDigits(stored: string | null | undefined): string {
  if (!stored) return "";

  const normalized = normalizePhPhone(stored);
  if (normalized) return normalized.slice(3);

  const digits = stored.replace(/\D/g, "");
  const from9 = digits.indexOf("9");
  return from9 === -1 ? "" : digits.slice(from9, from9 + 10);
}

/** Subscriber number length: 9 followed by nine more digits. */
export const PH_MOBILE_DIGITS = 10;

/* Departments live in the `departments` table, managed by the admin. There is
 * deliberately no list here — every school names them differently, and a list
 * only the developer can change is a list that goes stale. */

export type Role = "admin" | "teacher" | "student";

export const HOME_FOR_ROLE: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

-- Migration 022 — student mobile at enrolment
--
-- Run in the Supabase SQL Editor after 021-teacher-student-search.sql.
--
-- The student's own number was only settable by the student, after they had
-- signed in. But a roster export usually carries it, and a school that has
-- the number already should not make a child type it back in before they can
-- scan.

drop function if exists create_student_record(uuid, text, date, text, text, text, text, text);

create or replace function create_student_record(
  p_user_id       uuid,
  p_student_no    text,
  p_birthdate     date,
  p_department    text,
  p_contact_no    text,
  p_address       text,
  p_guardian_name text,
  p_guardian_no   text,
  p_key           text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  complete boolean;
begin
  -- Marked complete only when nothing is left for the student to supply, so a
  -- fully-populated roster row means they go straight to the scanner instead
  -- of being held at a form with every field already filled.
  complete :=
    coalesce(p_contact_no, '')    <> ''
    and coalesce(p_address, '')       <> ''
    and coalesce(p_guardian_name, '') <> ''
    and coalesce(p_guardian_no, '')   <> '';

  insert into students (
    user_id, student_no, birthdate, department, contact_no,
    address_enc, guardian_name_enc, guardian_phone_enc,
    profile_completed_at
  ) values (
    p_user_id, upper(p_student_no), p_birthdate,
    nullif(p_department, ''), nullif(p_contact_no, ''),
    pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key),
    case when complete then now() else null end
  );
end;
$$;

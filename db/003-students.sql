-- Migration 003 — student records and roster access
--
-- Run in the Supabase SQL Editor after 002-staff.sql.
--
-- Address, guardian name and guardian contact are personal data of minors
-- under RA 10173. They are encrypted at rest with pgp_sym_encrypt. The key
-- lives in the server environment as PII_KEY and is passed in per call, never
-- stored in the database — so a leaked dump on its own does not reveal them.

/**
 * Creates a student's record. Called by the teacher enrolment action after the
 * auth user and profile row exist.
 */
create or replace function create_student_record(
  p_user_id       uuid,
  p_student_no    text,
  p_birthdate     date,
  p_address       text,
  p_guardian_name text,
  p_guardian_no   text,
  p_key           text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into students (
    user_id, student_no, birthdate,
    address_enc, guardian_name_enc, guardian_phone_enc
  ) values (
    p_user_id, upper(p_student_no), p_birthdate,
    pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key)
  );
end;
$$;

/**
 * Full student record including decrypted PII. Admin only.
 *
 * Teachers deliberately cannot call this. A teacher needs to know who is in
 * their class, not where each child lives.
 */
create or replace function student_details(p_user_id uuid, p_key text)
returns table (
  student_no     text,
  full_name      text,
  birthdate      date,
  address        text,
  guardian_name  text,
  guardian_phone text
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select s.student_no, p.full_name, s.birthdate,
           pgp_sym_decrypt(s.address_enc, p_key),
           pgp_sym_decrypt(s.guardian_name_enc, p_key),
           pgp_sym_decrypt(s.guardian_phone_enc, p_key)
      from students s join profiles p on p.id = s.user_id
     where s.user_id = p_user_id;
end;
$$;

/**
 * Roster for one section: student number and name only, no PII.
 *
 * Callable by the section's own teacher or by an admin. This is how a teacher
 * sees their class without ever touching an encrypted column.
 */
create or replace function section_roster(p_section_id uuid)
returns table (
  user_id    uuid,
  student_no text,
  full_name  text,
  birthdate  date
)
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or teaches_section(p_section_id)) then
    raise exception 'not permitted';
  end if;

  return query
    select s.user_id, s.student_no, p.full_name, s.birthdate
      from enrollments e
      join students s on s.user_id = e.student_id
      join profiles p on p.id = s.user_id
     where e.section_id = p_section_id
     order by p.full_name;
end;
$$;

/** Look up a student by number so a teacher can enrol an existing one. */
create or replace function find_student_by_no(p_student_no text)
returns table (user_id uuid, student_no text, full_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or exists (
    select 1 from profiles where id = auth.uid() and role = 'teacher'
  )) then
    raise exception 'not permitted';
  end if;

  return query
    select s.user_id, s.student_no, p.full_name
      from students s join profiles p on p.id = s.user_id
     where upper(s.student_no) = upper(p_student_no);
end;
$$;

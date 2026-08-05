-- Migration 016 — students must complete their profile
--
-- Run in the Supabase SQL Editor after 015-dismiss-alerts.sql.
--
-- A student record created during enrolment can be missing the student's own
-- mobile number, and guardian details are sometimes typed in a hurry. This
-- makes the app ask for the gaps once, before the student can use it.
--
-- Stored as a flag rather than checked on read: the fields it depends on are
-- encrypted, so working it out on demand would mean decrypting three columns
-- on every page load.

alter table students
  add column if not exists profile_completed_at timestamptz;

-- Anyone already carrying a full record is treated as done, so existing
-- students are not sent to a form they have nothing to add to.
update students
   set profile_completed_at = now()
 where profile_completed_at is null
   and contact_no is not null and contact_no <> ''
   and address_enc is not null
   and guardian_name_enc is not null
   and guardian_phone_enc is not null;

/**
 * Whether a student still owes us details. Cheap: reads one column.
 */
create or replace function student_profile_complete(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select profile_completed_at is not null
       from students where user_id = p_user_id),
    true  -- not a student: nothing to complete
  );
$$;

-- Rebuilt so saving a full profile marks it complete, and saving a partial
-- one un-marks it.
drop function if exists update_student_profile(uuid, text, text, text, text, text);

create or replace function update_student_profile(
  p_user_id       uuid,
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
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  complete :=
    coalesce(p_contact_no, '')    <> ''
    and coalesce(p_address, '')       <> ''
    and coalesce(p_guardian_name, '') <> ''
    and coalesce(p_guardian_no, '')   <> '';

  update students set
    contact_no         = nullif(p_contact_no, ''),
    address_enc        = pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    guardian_name_enc  = pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    guardian_phone_enc = pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key),
    profile_completed_at = case when complete then now() else null end
  where user_id = p_user_id;
end;
$$;

-- Enrolment fills everything except the student's own mobile, so a record
-- created by a teacher starts incomplete on purpose — that one field is the
-- student's to supply.
drop function if exists create_student_record(uuid, text, date, text, text, text, text, text);

create or replace function create_student_record(
  p_user_id       uuid,
  p_student_no    text,
  p_birthdate     date,
  p_department    text,
  p_address       text,
  p_guardian_name text,
  p_guardian_no   text,
  p_key           text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into students (
    user_id, student_no, birthdate, department,
    address_enc, guardian_name_enc, guardian_phone_enc
  ) values (
    p_user_id, upper(p_student_no), p_birthdate, nullif(p_department, ''),
    pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key)
  );
end;
$$;

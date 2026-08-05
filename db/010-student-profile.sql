-- Migration 010 — student self-service profile
--
-- Run in the Supabase SQL Editor after 009-rejection-distance.sql.

alter table students
  add column if not exists contact_no text;

/**
 * A student updating their own details.
 *
 * Name, student number and birthday are deliberately absent. Those identify
 * the person to the school and are corrected by an administrator, not by the
 * student — a roster where anyone can rename themselves is not a roster.
 *
 * Address and guardian fields are re-encrypted here, so plaintext never lands
 * in a column even briefly.
 */
create or replace function update_student_profile(
  p_user_id       uuid,
  p_contact_no    text,
  p_address       text,
  p_guardian_name text,
  p_guardian_no   text,
  p_key           text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  update students set
    contact_no         = nullif(p_contact_no, ''),
    address_enc        = pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    guardian_name_enc  = pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    guardian_phone_enc = pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key)
  where user_id = p_user_id;
end;
$$;

/**
 * A student's own record, decrypted.
 *
 * Distinct from student_details(), which is admin-only. This one lets a
 * student see their own guardian details so they can correct them — nobody
 * else's.
 */
create or replace function my_student_profile(p_user_id uuid, p_key text)
returns table (
  student_no     text,
  full_name      text,
  birthdate      date,
  contact_no     text,
  address        text,
  guardian_name  text,
  guardian_phone text
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select s.student_no, p.full_name, s.birthdate, s.contact_no,
           pgp_sym_decrypt(s.address_enc, p_key),
           pgp_sym_decrypt(s.guardian_name_enc, p_key),
           pgp_sym_decrypt(s.guardian_phone_enc, p_key)
      from students s join profiles p on p.id = s.user_id
     where s.user_id = p_user_id;
end;
$$;

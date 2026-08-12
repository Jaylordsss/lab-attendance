-- Migration 028 — a student's record, readable from the account page
--
-- Run in the Supabase SQL Editor after 027-staff-record.sql.
--
-- student_record() writes to the audit log before returning, which makes it a
-- volatile function — and a volatile function cannot be called from a page
-- that also reads other things in parallel without surprises. Worse, it has
-- to be invoked as the signed-in administrator for its is_admin() check to
-- pass, which is easy to get wrong and fails silently when it is.
--
-- This splits the two jobs. Reading is a stable function; recording that a
-- reading happened is a separate call the page makes explicitly.

create or replace function student_details_for_admin(p_user_id uuid, p_key text)
returns table (
  student_no       text,
  full_name        text,
  birthdate        date,
  department       text,
  contact_no       text,
  address          text,
  guardian_name    text,
  guardian_phone   text,
  device_bound_at  timestamptz,
  profile_complete boolean,
  created_at       timestamptz
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      s.student_no, p.full_name, s.birthdate, s.department, s.contact_no,
      pgp_sym_decrypt(s.address_enc, p_key),
      pgp_sym_decrypt(s.guardian_name_enc, p_key),
      pgp_sym_decrypt(s.guardian_phone_enc, p_key),
      s.device_bound_at,
      s.profile_completed_at is not null,
      p.created_at
    from students s
    join profiles p on p.id = s.user_id
    where s.user_id = p_user_id;
end;
$$;

/**
 * Records that someone looked at a minor's personal data.
 *
 * Kept separate from the read so the read can stay stable. Under RA 10173 the
 * school has to be able to say who saw what and when — an access control that
 * leaves no trace is not much of a control.
 */
create or replace function log_student_record_view(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  insert into audit_log (actor_id, action, target, detail)
  values (
    auth.uid(), 'student_record_viewed', p_user_id::text,
    jsonb_build_object('includes_guardian_details', true)
  );
end;
$$;

-- Migration 019 — the full student record
--
-- Run in the Supabase SQL Editor after 018-manual-attendance.sql.

/**
 * One student, everything about them, decrypted. Admin only.
 *
 * This is the emergency lookup: a child is hurt in a laboratory and someone
 * needs a guardian's number in the next thirty seconds. That is the only
 * reason the guardian fields are stored at all, so the path to them should be
 * one page, not a database query.
 *
 * Every call is written to the audit log. Under RA 10173 the school has to be
 * able to say who looked at a minor's personal data and when — an access
 * control that leaves no trace is not much of a control.
 */
create or replace function student_record(p_user_id uuid, p_key text)
returns table (
  student_no     text,
  full_name      text,
  birthdate      date,
  department     text,
  contact_no     text,
  address        text,
  guardian_name  text,
  guardian_phone text,
  device_bound_at timestamptz,
  profile_complete boolean,
  created_at     timestamptz
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  insert into audit_log (actor_id, action, target, detail)
  values (
    auth.uid(), 'student_record_viewed', p_user_id::text,
    jsonb_build_object('includes_guardian_details', true)
  );

  return query
    select
      s.student_no, p.full_name, s.birthdate, s.department, s.contact_no,
      pgp_sym_decrypt(s.address_enc, p_key),
      pgp_sym_decrypt(s.guardian_name_enc, p_key),
      pgp_sym_decrypt(s.guardian_phone_enc, p_key),
      s.device_bound_at,
      s.profile_completed_at is not null,
      p.created_at
    from students s join profiles p on p.id = s.user_id
    where s.user_id = p_user_id;
end;
$$;

/** A student's attendance summary, for the same page. */
create or replace function student_attendance_summary(p_user_id uuid)
returns table (
  section_name  text,
  subject_code  text,
  present       bigint,
  late          bigint,
  absent        bigint,
  rate          numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or auth.uid() = p_user_id) then
    raise exception 'not permitted';
  end if;

  return query
    select
      sec.name, sub.code,
      count(*) filter (where a.status = 'present'),
      count(*) filter (where a.status = 'late'),
      count(*) filter (where a.status = 'absent'),
      round(
        100.0 * count(*) filter (where a.status in ('present', 'late'))
        / nullif(count(*), 0),
        0
      )
    from attendance a
    join class_sessions cs on cs.id = a.class_session_id
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    where a.student_id = p_user_id
    group by sec.name, sub.code
    order by sub.code;
end;
$$;

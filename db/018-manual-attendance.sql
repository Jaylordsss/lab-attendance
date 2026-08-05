-- Migration 018 — manual attendance
--
-- Run in the Supabase SQL Editor after 017-next-class.sql.

/**
 * The roster for a session, showing what each student's attendance currently
 * is — including those with none yet.
 *
 * A left join, so a student who has not scanned appears with a null status
 * rather than being absent from the list. That is the whole point: the
 * teacher needs to see who is missing in order to mark them.
 */
create or replace function session_roster(p_session_id uuid)
returns table (
  student_id      uuid,
  student_no      text,
  full_name       text,
  status          text,
  method          text,
  scanned_at      timestamptz,
  override_reason text
)
language plpgsql stable security definer set search_path = public as $$
declare
  sec_id uuid;
begin
  select section_id into sec_id from class_sessions where id = p_session_id;

  if not (is_admin() or teaches_section(sec_id)) then
    raise exception 'not permitted';
  end if;

  return query
    select
      s.user_id, s.student_no, p.full_name,
      a.status::text, a.method::text, a.scanned_at, a.override_reason
    from enrollments e
    join students s on s.user_id = e.student_id
    join profiles p on p.id = s.user_id
    left join attendance a
      on a.student_id = e.student_id
     and a.class_session_id = p_session_id
    where e.section_id = sec_id
    order by p.full_name;
end;
$$;

/**
 * Records or changes one student's attendance by hand.
 *
 * Every manual mark carries a reason, and the check on the attendance table
 * enforces a real one — ten characters at minimum, so "ok" will not pass.
 * A record a teacher can silently rewrite is not a record, and the reason is
 * what separates a correction from a favour.
 */
create or replace function mark_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_status     text,
  p_reason     text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  sec_id uuid;
begin
  select section_id into sec_id from class_sessions where id = p_session_id;

  if not (is_admin() or teaches_section(sec_id)) then
    raise exception 'not permitted';
  end if;

  if p_status not in ('present', 'late', 'absent', 'excused') then
    raise exception 'invalid status';
  end if;

  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'a reason of at least 10 characters is required';
  end if;

  if not exists (
    select 1 from enrollments
     where section_id = sec_id and student_id = p_student_id
  ) then
    raise exception 'student is not enrolled in this section';
  end if;

  insert into attendance (
    class_session_id, student_id, status, method, override_reason
  ) values (
    p_session_id, p_student_id, p_status::attendance_status,
    'manual', trim(p_reason)
  )
  on conflict (class_session_id, student_id) do update set
    status          = excluded.status,
    method          = 'manual',
    override_reason = excluded.override_reason,
    scanned_at      = now();

  insert into audit_log (actor_id, action, target, detail)
  values (
    auth.uid(), 'attendance_marked_manually', p_student_id::text,
    jsonb_build_object(
      'session_id', p_session_id,
      'status', p_status,
      'reason', trim(p_reason)
    )
  );
end;
$$;

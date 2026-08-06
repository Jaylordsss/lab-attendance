-- Migration 020 — stale sessions and teacher-side student fixes
--
-- Run in the Supabase SQL Editor after 019-student-record.sql.

/**
 * Closes any session still open after its period ended.
 *
 * A teacher who forgets to press End leaves the laboratory marked busy, and
 * only one session may be open per room — so the next class of the day cannot
 * start at all. Worse, the roll is never taken, so nobody is recorded absent
 * and the register quietly disagrees with reality.
 *
 * Runs on a schedule and again whenever a teacher tries to open a class, so
 * the common case fixes itself before anyone notices.
 */
create or replace function close_stale_sessions()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  today     date    := (now() at time zone 'Asia/Manila')::date;
  now_min   integer := extract(hour from now() at time zone 'Asia/Manila') * 60
                     + extract(minute from now() at time zone 'Asia/Manila');
  stale     uuid;
  closed    integer := 0;
begin
  for stale in
    select cs.id
      from class_sessions cs
      join sections sec on sec.id = cs.section_id
     where cs.status = 'open'
       and (
         -- Left over from an earlier day.
         cs.session_date < today
         -- Or today's period has finished. A short grace so a class running
         -- a few minutes over is not cut off mid-scan.
         or now_min > (extract(hour from sec.end_time) * 60
                     + extract(minute from sec.end_time) + 10)
       )
  loop
    perform close_session(stale);

    insert into audit_log (action, target, detail)
    values (
      'session_auto_closed', stale::text,
      jsonb_build_object('reason', 'period ended')
    );

    closed := closed + 1;
  end loop;

  return closed;
end;
$$;

/**
 * A teacher resetting one of their own students.
 *
 * Previously only an administrator could, which meant a teacher standing in
 * front of a student with a dead phone had to telephone the office in the
 * middle of a class. The teacher already controls that student's attendance
 * record; withholding a password reset protected nothing.
 *
 * Scoped tightly: only students enrolled in a section this teacher actually
 * teaches.
 */
create or replace function teaches_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from enrollments e
      join sections sec on sec.id = e.section_id
     where e.student_id = p_student_id
       and sec.teacher_id = auth.uid()
  );
$$;

/** Clears a student's device binding so they can scan from another phone. */
create or replace function unbind_student_device(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or teaches_student(p_student_id)) then
    raise exception 'not permitted';
  end if;

  update students
     set device_id = null, device_bound_at = null
   where user_id = p_student_id;

  insert into audit_log (actor_id, action, target)
  values (auth.uid(), 'device_unbound', p_student_id::text);
end;
$$;

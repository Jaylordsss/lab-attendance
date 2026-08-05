-- Migration 011 — a student's own schedule
--
-- Run in the Supabase SQL Editor after 010-student-profile.sql.

/**
 * The classes a student is enrolled in, with everything they need to know:
 * day, time, laboratory and teacher.
 *
 * A plain select cannot produce this. RLS lets a student read their own
 * sections, but the teacher's name lives in `profiles`, where the policy
 * limits them to their own row — so that join comes back empty. A security
 * definer function is the right tool: it returns one teacher name per class
 * the student actually attends, and nothing else.
 */
create or replace function my_schedule(p_user_id uuid)
returns table (
  section_id    uuid,
  section_name  text,
  subject_code  text,
  subject_title text,
  room_code     text,
  room_name     text,
  teacher_name  text,
  day_of_week   smallint,
  start_time    time,
  end_time      time,
  grace_minutes smallint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      sec.id, sec.name, sub.code, sub.title,
      r.code, r.name, p.full_name,
      sec.day_of_week, sec.start_time, sec.end_time, sec.grace_minutes
    from enrollments e
    join sections sec on sec.id = e.section_id
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = sec.teacher_id
    left join rooms r on r.id   = sec.default_room_id
    where e.student_id = p_user_id
    order by sec.day_of_week, sec.start_time;
end;
$$;

/**
 * Which of a student's classes is open for scanning right now, if any.
 *
 * Lets the scan screen say "Physics in LAB1 is open" before the camera is
 * pointed at anything, rather than leaving the student to discover it by
 * being refused.
 */
create or replace function my_open_class(p_user_id uuid)
returns table (
  section_name text,
  subject_code text,
  room_code    text,
  room_name    text,
  teacher_name text,
  opened_at    timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() <> p_user_id then
    raise exception 'not permitted';
  end if;

  return query
    select sec.name, sub.code, r.code, r.name, p.full_name, cs.opened_at
      from class_sessions cs
      join sections sec  on sec.id = cs.section_id
      join subjects sub  on sub.id = sec.subject_id
      join profiles p    on p.id   = sec.teacher_id
      join rooms r       on r.id   = cs.room_id
      join enrollments e on e.section_id = sec.id
     where cs.status = 'open'
       and e.student_id = p_user_id
     limit 1;
end;
$$;

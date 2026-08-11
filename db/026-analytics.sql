-- Migration 026 — a summary for any account
--
-- Run in the Supabase SQL Editor after 025-preserve-history.sql.

/**
 * How a teacher has run their classes.
 *
 * Not a list of everything they have done — a handful of figures that answer
 * the questions an administrator actually asks. Did the classes happen? Did
 * they start on time? How is turnout across their sections?
 *
 * `opened_late` compares against the scheduled start plus the section's own
 * grace period, so a teacher whose class allows fifteen minutes is not marked
 * late for opening at five past.
 */
create or replace function teacher_analytics(p_user_id uuid)
returns table (
  sections_taught  bigint,
  students_taught  bigint,
  classes_held     bigint,
  opened_late      bigint,
  left_open        bigint,
  avg_open_delay   numeric,
  present          bigint,
  late             bigint,
  absent           bigint,
  turnout          numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
  with own_sections as (
    select id, start_time, grace_minutes
      from sections
     where teacher_id = p_user_id
  ),
  own_sessions as (
    select
      cs.id,
      cs.status,
      cs.session_date,
      s.start_time,
      s.grace_minutes,
      extract(epoch from (
        (cs.opened_at at time zone 'Asia/Manila')
        - (cs.session_date + s.start_time)
      )) / 60 as delay_minutes
    from class_sessions cs
    join own_sections s on s.id = cs.section_id
  )
  select
    (select count(*) from own_sections),
    (select count(distinct e.student_id)
       from enrollments e
       join own_sections s on s.id = e.section_id),
    (select count(*) from own_sessions),
    (select count(*) from own_sessions
      where delay_minutes > grace_minutes),
    (select count(*) from own_sessions
      where status = 'open' and session_date < (now() at time zone 'Asia/Manila')::date),
    (select round(avg(greatest(delay_minutes, 0))::numeric, 0)
       from own_sessions),
    (select count(*) from attendance a
       join own_sessions os on os.id = a.class_session_id
      where a.status = 'present'),
    (select count(*) from attendance a
       join own_sessions os on os.id = a.class_session_id
      where a.status = 'late'),
    (select count(*) from attendance a
       join own_sessions os on os.id = a.class_session_id
      where a.status = 'absent'),
    (select round(
        100.0 * count(*) filter (where a.status in ('present','late'))
        / nullif(count(*), 0), 0)
       from attendance a
       join own_sessions os on os.id = a.class_session_id);
end;
$$;

/** Identity and status for any account, whatever its role. */
create or replace function account_summary(p_user_id uuid)
returns table (
  full_name  text,
  role       user_role,
  identifier text,
  department text,
  email      text,
  status     account_status,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      p.full_name,
      p.role,
      coalesce(st.faculty_id, s.student_no),
      coalesce(st.department, s.department),
      case when p.role = 'student' and u.email like '%@students.invalid'
           then null else u.email::text end,
      p.status,
      p.created_at
    from profiles p
    left join staff st     on st.user_id = p.id
    left join students s   on s.user_id  = p.id
    left join auth.users u on u.id       = p.id
    where p.id = p_user_id;
end;
$$;

/** A teacher's sections, with turnout for each. */
create or replace function teacher_sections_summary(p_user_id uuid)
returns table (
  section_name text,
  subject_code text,
  room_code    text,
  students     bigint,
  classes_held bigint,
  turnout      numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      sec.name, sub.code, coalesce(r.code, '—'),
      (select count(*) from enrollments e where e.section_id = sec.id),
      (select count(*) from class_sessions cs where cs.section_id = sec.id),
      (select round(
          100.0 * count(*) filter (where a.status in ('present','late'))
          / nullif(count(*), 0), 0)
         from attendance a
         join class_sessions cs on cs.id = a.class_session_id
        where cs.section_id = sec.id)
    from sections sec
    join subjects sub on sub.id = sec.subject_id
    left join rooms r on r.id = sec.default_room_id
    where sec.teacher_id = p_user_id
    order by sec.day_of_week, sec.start_time;
end;
$$;

-- Migration 029 — finding the students who need attention
--
-- Run in the Supabase SQL Editor after 028-student-record-fix.sql.

/**
 * Students below an attendance threshold.
 *
 * The eighty per cent rule already appears on a student's own page and in the
 * admin's, but only one student at a time — so finding who is below it means
 * opening every record in turn, which nobody does. A rule that has to be
 * looked for is a rule that goes unenforced.
 *
 * Sessions with no attendance rows at all are excluded: a class that was
 * opened and never closed has no absences recorded, and counting it would
 * make everyone look worse than they are.
 */
create or replace function at_risk_students(
  p_threshold integer default 80,
  p_min_classes integer default 3
)
returns table (
  student_id     uuid,
  student_no     text,
  full_name      text,
  department     text,
  guardian_phone_set boolean,
  classes_marked bigint,
  attended       bigint,
  absent         bigint,
  rate           numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      s.user_id,
      s.student_no,
      p.full_name,
      s.department,
      s.guardian_phone_enc is not null,
      count(a.id),
      count(*) filter (where a.status in ('present', 'late')),
      count(*) filter (where a.status = 'absent'),
      round(
        100.0 * count(*) filter (where a.status in ('present', 'late'))
        / nullif(count(a.id), 0),
        0
      )
    from students s
    join profiles p on p.id = s.user_id
    join attendance a on a.student_id = s.user_id
    where p.status = 'active'
    group by s.user_id, s.student_no, p.full_name, s.department
    having count(a.id) >= greatest(p_min_classes, 1)
       and round(
             100.0 * count(*) filter (where a.status in ('present', 'late'))
             / nullif(count(a.id), 0),
             0
           ) < p_threshold
    order by 9, 3;
end;
$$;

/**
 * One student's attendance, every session, for the admin log.
 *
 * The question a guardian asks is about a person and a date, not a section —
 * "was he in the laboratory on the twelfth?" — and until now the log could
 * only be narrowed the other way round.
 */
create or replace function student_attendance_log(
  p_student_id uuid,
  p_from date default null,
  p_to   date default null
)
returns table (
  session_date date,
  subject_code text,
  section_name text,
  room_code    text,
  teacher_name text,
  status       text,
  scanned_at   timestamptz,
  method       text,
  reason       text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      cs.session_date, sub.code, sec.name, r.code, tp.full_name,
      a.status::text,
      case when a.method = 'auto_absent' then null else a.scanned_at end,
      a.method::text,
      a.override_reason
    from attendance a
    join class_sessions cs on cs.id = a.class_session_id
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    join rooms r      on r.id   = cs.room_id
    join profiles tp  on tp.id  = sec.teacher_id
    where a.student_id = p_student_id
      and (p_from is null or cs.session_date >= p_from)
      and (p_to is null   or cs.session_date <= p_to)
    order by cs.session_date desc, sec.start_time desc;
end;
$$;

/** Finds a student by number or name, for the admin's search box. */
create or replace function find_students(p_query text)
returns table (
  student_id uuid,
  student_no text,
  full_name  text,
  department text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  if coalesce(length(trim(p_query)), 0) < 2 then
    return;
  end if;

  return query
    select s.user_id, s.student_no, p.full_name, s.department
      from students s
      join profiles p on p.id = s.user_id
     where s.student_no ilike '%' || trim(p_query) || '%'
        or p.full_name ilike '%' || trim(p_query) || '%'
     order by p.full_name
     limit 20;
end;
$$;

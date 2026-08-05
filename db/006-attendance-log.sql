-- Migration 006 — admin attendance log
--
-- Run in the Supabase SQL Editor after 005-reports.sql.

/**
 * Every attendance record, filterable.
 *
 * All filters are optional and null means "no restriction", so one function
 * serves the whole admin log rather than a query per combination.
 */
create or replace function attendance_log(
  p_from       date default null,
  p_to         date default null,
  p_room_id    uuid default null,
  p_subject_id uuid default null,
  p_teacher_id uuid default null,
  p_section_id uuid default null,
  p_day        int  default null,
  p_status     text default null
)
returns table (
  session_date  date,
  student_no    text,
  full_name     text,
  status        text,
  scanned_at    timestamptz,
  section_name  text,
  subject_code  text,
  room_code     text,
  teacher_name  text,
  start_time    time,
  day_of_week   smallint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      cs.session_date,
      st.student_no,
      p.full_name,
      a.status::text,
      case when a.method = 'auto_absent' then null else a.scanned_at end,
      sec.name,
      sub.code,
      r.code,
      tp.full_name,
      sec.start_time,
      sec.day_of_week
    from attendance a
    join class_sessions cs on cs.id = a.class_session_id
    join sections sec      on sec.id = cs.section_id
    join subjects sub      on sub.id = sec.subject_id
    join rooms r           on r.id  = cs.room_id
    join profiles tp       on tp.id = sec.teacher_id
    join students st       on st.user_id = a.student_id
    join profiles p        on p.id  = a.student_id
    where (p_from is null       or cs.session_date >= p_from)
      and (p_to is null         or cs.session_date <= p_to)
      and (p_room_id is null    or cs.room_id = p_room_id)
      and (p_subject_id is null or sec.subject_id = p_subject_id)
      and (p_teacher_id is null or sec.teacher_id = p_teacher_id)
      and (p_section_id is null or sec.id = p_section_id)
      and (p_day is null        or sec.day_of_week = p_day)
      and (p_status is null     or a.status::text = p_status)
    order by cs.session_date desc, sec.start_time, p.full_name;
end;
$$;

/** Refused scans over a date range, for the same log view. */
create or replace function rejection_log(
  p_from    date default null,
  p_to      date default null,
  p_room_id uuid default null
)
returns table (
  at         timestamptz,
  student_no text,
  full_name  text,
  reason     text,
  room_code  text,
  section_name text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      rj.at,
      coalesce(st.student_no, '—'),
      coalesce(p.full_name, 'Unknown'),
      rj.reason,
      coalesce(r.code, '—'),
      coalesce(sec.name, '—')
    from scan_rejections rj
    left join students st on st.user_id = rj.student_id
    left join profiles p  on p.id = rj.student_id
    left join rooms r     on r.id = rj.room_id
    left join class_sessions cs on cs.id = rj.class_session_id
    left join sections sec on sec.id = cs.section_id
    where (p_from is null    or rj.at::date >= p_from)
      and (p_to is null      or rj.at::date <= p_to)
      and (p_room_id is null or rj.room_id = p_room_id)
    order by rj.at desc;
end;
$$;

/** Options for the filter dropdowns, in one round trip. */
create or replace function filter_options()
returns json
language sql stable security definer set search_path = public as $$
  select case when is_admin() then json_build_object(
    'rooms',    (select coalesce(json_agg(json_build_object('id', id, 'code', code, 'name', name) order by code), '[]') from rooms),
    'subjects', (select coalesce(json_agg(json_build_object('id', id, 'code', code, 'title', title) order by code), '[]') from subjects),
    'teachers', (select coalesce(json_agg(json_build_object('id', id, 'name', full_name) order by full_name), '[]') from profiles where role = 'teacher'),
    'sections', (select coalesce(json_agg(json_build_object('id', id, 'name', name) order by name), '[]') from sections)
  ) else null end;
$$;

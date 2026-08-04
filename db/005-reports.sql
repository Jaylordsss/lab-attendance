-- Migration 005 — rejected scans and the session report
--
-- Run in the Supabase SQL Editor after schema-complete.sql.

/**
 * Every scan that did not become attendance.
 *
 * Without this the record is one-sided: you see who got in, never who tried
 * and failed. A student who scanned from the corridor, or scanned the wrong
 * laboratory, or turned up to a class they are not enrolled in, leaves no
 * trace — and those are exactly the cases a teacher needs to see.
 *
 * Kept separate from `attendance` on purpose. A rejection is not a weaker
 * kind of attendance; mixing them would make every attendance query carry a
 * status filter it could forget.
 */
create table if not exists scan_rejections (
  id               bigserial primary key,
  class_session_id uuid references class_sessions(id) on delete cascade,
  student_id       uuid references profiles(id) on delete set null,
  room_id          uuid references rooms(id) on delete set null,
  reason           text not null,
  device_id        text,
  lat              double precision,
  lng              double precision,
  at               timestamptz not null default now()
);

create index if not exists scan_rejections_session_idx
  on scan_rejections (class_session_id, at desc);
create index if not exists scan_rejections_at_idx
  on scan_rejections (at desc);

alter table scan_rejections enable row level security;

create policy scan_rejections_read on scan_rejections for select
  using (
    is_admin()
    or exists (
      select 1 from class_sessions cs
       where cs.id = scan_rejections.class_session_id
         and teaches_section(cs.section_id)
    )
  );

/**
 * Everything needed for one session's report, in a single call.
 *
 * `kind` separates the two halves: 'attendance' rows are the record, and
 * 'rejected' rows are the attempts. Absent students appear as attendance rows
 * with a null time, because close_session() writes them that way.
 */
create or replace function session_report(p_session_id uuid)
returns table (
  kind       text,
  student_no text,
  full_name  text,
  status     text,
  at         timestamptz,
  detail     text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or exists (
    select 1 from class_sessions cs
     where cs.id = p_session_id and teaches_section(cs.section_id)
  )) then
    raise exception 'not permitted';
  end if;

  return query
    select
      'attendance'::text,
      s.student_no,
      p.full_name,
      a.status::text,
      case when a.method = 'auto_absent' then null else a.scanned_at end,
      a.method::text
    from attendance a
    join students s on s.user_id = a.student_id
    join profiles p on p.id = a.student_id
    where a.class_session_id = p_session_id

    union all

    select
      'rejected'::text,
      coalesce(s.student_no, '—'),
      coalesce(p.full_name, 'Unknown'),
      r.reason,
      r.at,
      null
    from scan_rejections r
    left join students s on s.user_id = r.student_id
    left join profiles p on p.id = r.student_id
    where r.class_session_id = p_session_id

    order by 1, 5 nulls last, 3;
end;
$$;

/** Header details for the report. */
create or replace function session_header(p_session_id uuid)
returns table (
  section_name  text,
  subject_code  text,
  subject_title text,
  room_code     text,
  room_name     text,
  teacher_name  text,
  session_date  date,
  start_time    time,
  end_time      time,
  grace_minutes smallint,
  opened_at     timestamptz,
  closed_at     timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or exists (
    select 1 from class_sessions cs
     where cs.id = p_session_id and teaches_section(cs.section_id)
  )) then
    raise exception 'not permitted';
  end if;

  return query
    select sec.name, sub.code, sub.title, r.code, r.name, p.full_name,
           cs.session_date, sec.start_time, sec.end_time, sec.grace_minutes,
           cs.opened_at, cs.closed_at
      from class_sessions cs
      join sections sec on sec.id = cs.section_id
      join subjects sub on sub.id = sec.subject_id
      join profiles p   on p.id   = sec.teacher_id
      join rooms r      on r.id   = cs.room_id
     where cs.id = p_session_id;
end;
$$;

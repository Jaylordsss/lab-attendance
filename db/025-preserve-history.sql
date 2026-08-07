-- Migration 025 — attendance outlives the account
--
-- Run in the Supabase SQL Editor after 024-account-removal.sql.
--
-- Students leave. They transfer, they drop out, and the school has no reason
-- to keep an account for someone who is gone — but every register they
-- appeared on must still read the same afterwards.
--
-- Until now attendance pointed at the account and cascaded with it, so
-- deleting a student rewrote history: a class that recorded thirty present
-- would afterwards show twenty-nine, with nothing to say why.
--
-- The fix is to stop the record depending on the account. Each attendance row
-- carries the student's number and name at the moment it was written, so the
-- row is complete on its own and the account becomes safe to remove.

alter table attendance
  add column if not exists student_no   text,
  add column if not exists student_name text;

-- Fill in every row that already exists.
update attendance a
   set student_no   = s.student_no,
       student_name = p.full_name
  from students s
  join profiles p on p.id = s.user_id
 where s.user_id = a.student_id
   and a.student_no is null;

/**
 * Copies identity onto the row as it is written.
 *
 * A trigger rather than application code, so every path that records
 * attendance — a scan, a manual mark, the absence sweep at close — is covered
 * without each remembering to do it.
 */
create or replace function stamp_attendance_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_no is null or new.student_name is null then
    select s.student_no, p.full_name
      into new.student_no, new.student_name
      from students s
      join profiles p on p.id = s.user_id
     where s.user_id = new.student_id;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_stamp_identity on attendance;

create trigger attendance_stamp_identity
  before insert on attendance
  for each row execute function stamp_attendance_identity();

-- The link to the account becomes optional. Deleting a student now empties
-- this column instead of taking the row with it.
alter table attendance
  drop constraint if exists attendance_student_id_fkey;

alter table attendance
  alter column student_id drop not null;

alter table attendance
  add constraint attendance_student_id_fkey
  foreign key (student_id) references students(user_id) on delete set null;

-- Same for refused scans: worth keeping who tried, even once they have gone.
alter table scan_rejections
  add column if not exists student_no   text,
  add column if not exists student_name text;

update scan_rejections rj
   set student_no   = s.student_no,
       student_name = p.full_name
  from students s
  join profiles p on p.id = s.user_id
 where s.user_id = rj.student_id
   and rj.student_no is null;

create or replace function stamp_rejection_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_id is not null and new.student_no is null then
    select s.student_no, p.full_name
      into new.student_no, new.student_name
      from students s
      join profiles p on p.id = s.user_id
     where s.user_id = new.student_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rejections_stamp_identity on scan_rejections;

create trigger rejections_stamp_identity
  before insert on scan_rejections
  for each row execute function stamp_rejection_identity();

-- ------------------------------------------------------------------
-- Reports read the snapshot, not the account
-- ------------------------------------------------------------------

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
      coalesce(a.student_no, '—'),
      coalesce(a.student_name, 'Removed student'),
      a.status::text,
      case when a.method = 'auto_absent' then null else a.scanned_at end,
      a.method::text
    from attendance a
    where a.class_session_id = p_session_id

    union all

    select
      'rejected'::text,
      coalesce(rj.student_no, '—'),
      coalesce(rj.student_name, 'Unknown'),
      rj.reason,
      rj.at,
      null
    from scan_rejections rj
    where rj.class_session_id = p_session_id

    order by 1, 5 nulls last, 3;
end;
$$;

drop function if exists attendance_log(date, date, uuid, uuid, uuid, uuid, int, text);

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
      coalesce(a.student_no, '—'),
      coalesce(a.student_name, 'Removed student'),
      a.status::text,
      case when a.method = 'auto_absent' then null else a.scanned_at end,
      sec.name, sub.code, r.code, tp.full_name,
      sec.start_time, sec.day_of_week
    from attendance a
    join class_sessions cs on cs.id = a.class_session_id
    join sections sec      on sec.id = cs.section_id
    join subjects sub      on sub.id = sec.subject_id
    join rooms r           on r.id  = cs.room_id
    join profiles tp       on tp.id = sec.teacher_id
    where (p_from is null       or cs.session_date >= p_from)
      and (p_to is null         or cs.session_date <= p_to)
      and (p_room_id is null    or cs.room_id = p_room_id)
      and (p_subject_id is null or sec.subject_id = p_subject_id)
      and (p_teacher_id is null or sec.teacher_id = p_teacher_id)
      and (p_section_id is null or sec.id = p_section_id)
      and (p_day is null        or sec.day_of_week = p_day)
      and (p_status is null     or a.status::text = p_status)
    order by cs.session_date desc, sec.start_time, 3;
end;
$$;

/**
 * Whether an account can be deleted, and what it would cost.
 *
 * Attendance is no longer counted as a blocker: those rows now stand on their
 * own. What still blocks is a teacher with sections, because deleting them
 * would leave classes with nobody to open them.
 */
create or replace function account_footprint(p_user_id uuid)
returns table (
  full_name        text,
  role             user_role,
  attendance_rows  bigint,
  sections_taught  bigint,
  enrolments       bigint,
  is_last_admin    boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      p.full_name,
      p.role,
      (select count(*) from attendance a where a.student_id = p_user_id),
      (select count(*) from sections s where s.teacher_id = p_user_id),
      (select count(*) from enrollments e where e.student_id = p_user_id),
      p.role = 'admin'
        and (select count(*) from profiles where role = 'admin') <= 1
    from profiles p
    where p.id = p_user_id;
end;
$$;

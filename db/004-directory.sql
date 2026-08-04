-- Migration 004 — user directory and forced password change
--
-- Run in the Supabase SQL Editor after 003-students.sql.

-- Set when an admin or teacher issues a password. Cleared when the user picks
-- their own. Lets the app nudge people off a shared temporary password.
alter table profiles
  add column if not exists must_change_password boolean not null default false;

/**
 * Every account in one list, for the admin directory.
 *
 * `identifier` is the faculty ID for staff and the student number for
 * students. No encrypted column is touched — this is a directory, not a
 * personal record. Guardian details stay behind student_details().
 */
create or replace function user_directory(
  p_role       text default null,
  p_department text default null,
  p_search     text default null
)
returns table (
  user_id    uuid,
  full_name  text,
  role       user_role,
  identifier text,
  department text,
  email      text,
  status     text
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      p.id,
      p.full_name,
      p.role,
      coalesce(st.faculty_id, s.student_no) as identifier,
      st.department,
      case when p.role = 'student' then null else u.email::text end,
      case when p.must_change_password then 'temporary password' else 'active' end
    from profiles p
    left join staff st on st.user_id = p.id
    left join students s on s.user_id = p.id
    left join auth.users u on u.id = p.id
    where (p_role is null or p.role::text = p_role)
      and (p_department is null or st.department = p_department)
      and (
        p_search is null
        or p.full_name ilike '%' || p_search || '%'
        or coalesce(st.faculty_id, s.student_no) ilike '%' || p_search || '%'
      )
    order by p.role, p.full_name;
end;
$$;

/** Distinct departments, for the filter dropdown. */
create or replace function department_list()
returns table (department text)
language sql stable security definer set search_path = public as $$
  select distinct s.department
    from staff s
   where is_admin()
   order by 1;
$$;

/**
 * Sections with their enrolment counts, for the admin sections list.
 */
create or replace function section_summary()
returns table (
  section_id   uuid,
  name         text,
  subject_code text,
  room_code    text,
  teacher_name text,
  day_of_week  smallint,
  start_time   time,
  end_time     time,
  student_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    sec.id, sec.name, sub.code, r.code, p.full_name,
    sec.day_of_week, sec.start_time, sec.end_time,
    count(e.student_id)
  from sections sec
  join subjects sub on sub.id = sec.subject_id
  join profiles p on p.id = sec.teacher_id
  left join rooms r on r.id = sec.default_room_id
  left join enrollments e on e.section_id = sec.id
  where is_admin()
  group by sec.id, sub.code, r.code, p.full_name
  order by sec.day_of_week, sec.start_time;
$$;

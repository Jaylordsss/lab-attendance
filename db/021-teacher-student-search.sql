-- Migration 021 — teacher student lookup
--
-- Run in the Supabase SQL Editor after 020-stale-sessions.sql.

/**
 * Finds a student by number, but only one this teacher actually teaches.
 *
 * Searching by number rather than picking from a roster is deliberate. A
 * reset button beside forty names is one mis-tap away from locking out the
 * wrong child, and the teacher always has the number in front of them — it is
 * on the student's ID.
 *
 * Returns at most one row. An exact match, not a prefix: a partial number
 * would let a teacher enumerate students outside their own sections by
 * watching which fragments return something.
 */
create or replace function teacher_find_student(p_student_no text)
returns table (
  student_id     uuid,
  student_no     text,
  full_name      text,
  section_names  text,
  device_bound   boolean,
  needs_password boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles
     where id = auth.uid() and role in ('teacher', 'admin')
  ) then
    raise exception 'not permitted';
  end if;

  return query
    select
      s.user_id,
      s.student_no,
      p.full_name,
      string_agg(distinct sub.code || ' ' || sec.name, ', '),
      s.device_id is not null,
      pr.must_change_password
    from students s
    join profiles p  on p.id = s.user_id
    join profiles pr on pr.id = s.user_id
    join enrollments e on e.student_id = s.user_id
    join sections sec  on sec.id = e.section_id
    join subjects sub  on sub.id = sec.subject_id
    where upper(s.student_no) = upper(trim(p_student_no))
      and (is_admin() or sec.teacher_id = auth.uid())
    group by s.user_id, s.student_no, p.full_name, s.device_id,
             pr.must_change_password;
end;
$$;

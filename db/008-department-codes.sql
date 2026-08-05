-- Migration 008 — department codes and counts
--
-- Run in the Supabase SQL Editor after 007-departments.sql.

alter table departments
  add column if not exists code text;

-- Backfill from the name so existing rows are not left blank: first letters of
-- each word, or the first four characters for a single-word name.
update departments
   set code = upper(
     case
       when name like '% %' then
         (select string_agg(left(word, 1), '')
            from unnest(string_to_array(name, ' ')) as word
           where word <> '')
       else left(name, 4)
     end
   )
 where code is null;

alter table departments
  alter column code set not null;

create unique index if not exists departments_code_idx
  on departments (lower(code));

/**
 * Departments with headcounts.
 *
 * `faculty_count` is direct — staff carry a department name.
 *
 * `student_count` is not, because students have no department of their own.
 * A student belongs to a department by way of the classes they take: count
 * the distinct students enrolled in any section whose teacher sits in that
 * department. Distinct matters — a student taking three of that department's
 * subjects is still one student.
 */
create or replace function department_summary()
returns table (
  id            uuid,
  name          text,
  code          text,
  faculty_count bigint,
  student_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    d.id,
    d.name,
    d.code,
    (select count(*) from staff s
      where lower(s.department) = lower(d.name)),
    (select count(distinct e.student_id)
       from enrollments e
       join sections sec on sec.id = e.section_id
       join staff st     on st.user_id = sec.teacher_id
      where lower(st.department) = lower(d.name))
  from departments d
  where is_admin()
  order by d.name;
$$;

/** Name and code together, for dropdowns that want to show both. */
create or replace function department_list()
returns table (department text, code text)
language sql stable security definer set search_path = public as $$
  select name, code from departments
   where auth.uid() is not null
   order by name;
$$;

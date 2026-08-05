-- Migration 013 — students belong to a department
--
-- Run in the Supabase SQL Editor after 011-student-schedule.sql.
-- (012 is optional and only applies if you want a new session per class start.)
--
-- Until now a student's department was inferred from whoever taught their
-- sections. That works for a headcount but not for filtering: a student with
-- no enrolments belonged nowhere, and one taking subjects from two
-- departments belonged to both.

alter table students
  add column if not exists department text;

create index if not exists students_department_idx on students (department);

-- Backfill from the teacher of whichever section they joined first, so
-- existing students are not left blank.
update students s
   set department = sub.department
  from (
    select distinct on (e.student_id) e.student_id, st.department
      from enrollments e
      join sections sec on sec.id = e.section_id
      join staff st     on st.user_id = sec.teacher_id
     where st.department is not null
     order by e.student_id, sec.start_time
  ) sub
 where sub.student_id = s.user_id
   and s.department is null;

-- The signature changes, so the old one has to go first.
drop function if exists create_student_record(uuid, text, date, text, text, text, text);

create or replace function create_student_record(
  p_user_id       uuid,
  p_student_no    text,
  p_birthdate     date,
  p_department    text,
  p_address       text,
  p_guardian_name text,
  p_guardian_no   text,
  p_key           text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into students (
    user_id, student_no, birthdate, department,
    address_enc, guardian_name_enc, guardian_phone_enc
  ) values (
    p_user_id, upper(p_student_no), p_birthdate, nullif(p_department, ''),
    pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key)
  );
end;
$$;

-- Students now carry their own department, so the directory can filter on it
-- directly instead of only matching staff.
drop function if exists user_directory(text, text, text);

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
      p.id, p.full_name, p.role,
      coalesce(st.faculty_id, s.student_no),
      coalesce(st.department, s.department),
      case when p.role = 'student' then null else u.email::text end,
      case when p.must_change_password then 'temporary password' else 'active' end
    from profiles p
    left join staff st     on st.user_id = p.id
    left join students s   on s.user_id  = p.id
    left join auth.users u on u.id       = p.id
    where (p_role is null or p.role::text = p_role)
      and (
        p_department is null
        or st.department = p_department
        or s.department = p_department
      )
      and (
        p_search is null
        or p.full_name ilike '%' || p_search || '%'
        or coalesce(st.faculty_id, s.student_no) ilike '%' || p_search || '%'
      )
    order by p.role, p.full_name;
end;
$$;

-- Counting students directly is both simpler and more honest than inferring
-- it through their teachers' sections.
drop function if exists department_summary();

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
    d.id, d.name, d.code,
    (select count(*) from staff s
      where lower(s.department) = lower(d.name)),
    (select count(*) from students st
      where lower(st.department) = lower(d.name))
  from departments d
  where is_admin()
  order by d.name;
$$;

/** A student's own department, for the account page. */
drop function if exists my_student_profile(uuid, text);

create or replace function my_student_profile(p_user_id uuid, p_key text)
returns table (
  student_no     text,
  full_name      text,
  birthdate      date,
  department     text,
  contact_no     text,
  address        text,
  guardian_name  text,
  guardian_phone text
)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select s.student_no, p.full_name, s.birthdate, s.department, s.contact_no,
           pgp_sym_decrypt(s.address_enc, p_key),
           pgp_sym_decrypt(s.guardian_name_enc, p_key),
           pgp_sym_decrypt(s.guardian_phone_enc, p_key)
      from students s join profiles p on p.id = s.user_id
     where s.user_id = p_user_id;
end;
$$;

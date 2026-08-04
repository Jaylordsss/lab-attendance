-- Migration 002 — staff records for admins and teachers
--
-- `profiles` stays minimal: identity and role only. Everything role-specific
-- lives in a side table — `students` already works this way, and `staff` is
-- its counterpart. Teachers created by an admin get a row here too.
--
-- Run this in the Supabase SQL Editor after schema.sql.

create table staff (
  user_id     uuid primary key references profiles(id) on delete cascade,
  faculty_id  text not null unique,
  department  text not null,
  -- Real address, unlike students. Staff can reset their own passwords.
  contact_no  text,
  created_at  timestamptz not null default now()
);

create index staff_department_idx on staff (department);

alter table staff enable row level security;

-- See your own record; admins see everyone.
create policy staff_self on staff for select
  using (user_id = auth.uid() or is_admin());

-- Faculty IDs are compared case-insensitively, so 'T-2024-01' and 't-2024-01'
-- cannot both exist.
create unique index staff_faculty_id_lower_idx on staff (lower(faculty_id));

-- Convenience view for the admin dashboard: one row per staff member with
-- their email, without exposing auth.users directly.
create or replace function staff_directory()
returns table (
  user_id    uuid,
  full_name  text,
  role       user_role,
  faculty_id text,
  department text,
  email      text
)
language sql stable security definer set search_path = public, auth as $$
  select s.user_id, p.full_name, p.role, s.faculty_id, s.department, u.email::text
    from staff s
    join profiles p on p.id = s.user_id
    join auth.users u on u.id = s.user_id
   where is_admin()
   order by p.full_name;
$$;

-- Migration 007 — departments
--
-- Run in the Supabase SQL Editor after 006-attendance-log.sql.
--
-- Departments were a hardcoded list in the application. They belong in the
-- database: every school names them differently, and a list that only the
-- developer can change is a list that goes stale.

create table if not exists departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitive: "Science" and "science" are the same department.
create unique index if not exists departments_name_idx
  on departments (lower(name));

alter table departments enable row level security;

-- Everyone signed in can read them — the dropdowns need it. Writes go through
-- server actions using the service role after an admin check.
create policy departments_read on departments for select
  using (auth.uid() is not null);

-- Carry over whatever is already in use, so nothing breaks on deploy.
insert into departments (name)
select distinct department from staff
where department is not null and department <> ''
on conflict do nothing;

/**
 * Departments with a count of the staff in each, for the admin page.
 * The count is what tells an admin whether a department is safe to delete.
 */
create or replace function department_summary()
returns table (id uuid, name text, staff_count bigint)
language sql stable security definer set search_path = public as $$
  select d.id, d.name, count(s.user_id)
    from departments d
    left join staff s on lower(s.department) = lower(d.name)
   where is_admin()
   group by d.id, d.name
   order by d.name;
$$;

-- Replaces the earlier version, which read distinct values out of `staff` and
-- so could only ever list departments that already had someone in them.
create or replace function department_list()
returns table (department text)
language sql stable security definer set search_path = public as $$
  select name from departments where auth.uid() is not null order by name;
$$;

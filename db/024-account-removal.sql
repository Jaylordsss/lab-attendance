-- Migration 024 — removing accounts safely
--
-- Run in the Supabase SQL Editor after 023-history.sql.

/**
 * How much history an account carries.
 *
 * Deleting a student cascades to every attendance row they ever earned, which
 * silently rewrites the register — a class that had thirty present last term
 * would suddenly show twenty-nine. So the interface needs to know the cost
 * before offering the choice, and suspension is offered instead when there is
 * anything to lose.
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

-- Suspended accounts keep every row they own; they simply cannot sign in.
comment on column profiles.status is
  'active or suspended. A suspended account is refused at sign-in but keeps its attendance history, which deleting would destroy.';

create index if not exists profiles_status_idx on profiles (status)
  where status = 'suspended';

-- Migration 027 — staff contact details for the record page
--
-- Run in the Supabase SQL Editor after 026-analytics.sql.

/**
 * Everything an administrator needs about one staff member.
 *
 * The mobile number is the point. A student's record already carries a
 * guardian's number for the day something happens in a laboratory; a
 * teacher's record should carry theirs for the same reason, and until now it
 * was only visible on the teacher's own account page.
 */
create or replace function staff_record(p_user_id uuid)
returns table (
  full_name  text,
  faculty_id text,
  department text,
  email      text,
  contact_no text,
  status     account_status,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      p.full_name, st.faculty_id, st.department,
      u.email::text, st.contact_no, p.status, p.created_at
    from profiles p
    join staff st on st.user_id = p.id
    left join auth.users u on u.id = p.id
    where p.id = p_user_id;
end;
$$;

-- Migration 023 — looking backwards
--
-- Run in the Supabase SQL Editor after 022-student-contact.sql.

/**
 * Every session a section has held, newest first.
 *
 * Until now a teacher could only see today. The question that exposes the gap
 * is the ordinary one — a guardian asks whether their child was in the
 * laboratory on the twelfth — and the answer sat in the database with no way
 * to reach it.
 */
create or replace function section_sessions(
  p_section_id uuid,
  p_limit      integer default 60
)
returns table (
  id           uuid,
  session_date date,
  status       session_status,
  opened_at    timestamptz,
  closed_at    timestamptz,
  present      bigint,
  late         bigint,
  absent       bigint,
  refused      bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or teaches_section(p_section_id)) then
    raise exception 'not permitted';
  end if;

  return query
    select
      cs.id, cs.session_date, cs.status, cs.opened_at, cs.closed_at,
      count(*) filter (where a.status = 'present'),
      count(*) filter (where a.status = 'late'),
      count(*) filter (where a.status = 'absent'),
      (select count(*) from scan_rejections rj
        where rj.class_session_id = cs.id)
    from class_sessions cs
    left join attendance a on a.class_session_id = cs.id
    where cs.section_id = p_section_id
    group by cs.id
    order by cs.session_date desc, cs.opened_at desc
    limit greatest(p_limit, 1);
end;
$$;

/**
 * A student's own attendance, class by class and day by day.
 *
 * Students have been able to mark attendance since the beginning but never to
 * see it. Showing the figure is what makes it matter to them — an eighty per
 * cent rule nobody can check is a rule nobody acts on.
 */
create or replace function my_attendance(p_user_id uuid, p_limit integer default 40)
returns table (
  session_date date,
  subject_code text,
  section_name text,
  room_code    text,
  status       text,
  scanned_at   timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      cs.session_date, sub.code, sec.name, r.code,
      a.status::text,
      case when a.method = 'auto_absent' then null else a.scanned_at end
    from attendance a
    join class_sessions cs on cs.id = a.class_session_id
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    join rooms r      on r.id   = cs.room_id
    where a.student_id = p_user_id
    order by cs.session_date desc, sec.start_time desc
    limit greatest(p_limit, 1);
end;
$$;

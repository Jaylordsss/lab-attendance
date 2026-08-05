-- Migration 009 — distance on refused scans
--
-- Run in the Supabase SQL Editor after 008-department-codes.sql.

alter table scan_rejections
  add column if not exists distance_m integer;

comment on column scan_rejections.distance_m is
  'Metres from the laboratory when the scan was refused for being out of range. Null for every other reason.';

drop function if exists rejection_log(date, date, uuid);

/** Refused scans over a date range, for the admin log. */
create or replace function rejection_log(
  p_from    date default null,
  p_to      date default null,
  p_room_id uuid default null
)
returns table (
  at           timestamptz,
  student_no   text,
  full_name    text,
  reason       text,
  distance_m   integer,
  room_code    text,
  section_name text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      rj.at,
      coalesce(st.student_no, '—'),
      coalesce(p.full_name, 'Unknown'),
      rj.reason,
      rj.distance_m,
      coalesce(r.code, '—'),
      coalesce(sec.name, '—')
    from scan_rejections rj
    left join students st on st.user_id = rj.student_id
    left join profiles p  on p.id = rj.student_id
    left join rooms r     on r.id = rj.room_id
    left join class_sessions cs on cs.id = rj.class_session_id
    left join sections sec on sec.id = cs.section_id
    where (p_from is null    or rj.at::date >= p_from)
      and (p_to is null      or rj.at::date <= p_to)
      and (p_room_id is null or rj.room_id = p_room_id)
    order by rj.at desc;
end;
$$;

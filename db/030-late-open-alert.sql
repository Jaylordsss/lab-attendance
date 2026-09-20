-- Migration 030 — alert when a teacher opens a class 15+ minutes late
--
-- Run in the Supabase SQL Editor after 029-at-risk.sql.
--
-- Adds a new `late_open` alert kind to admin_alerts and also tightens the
-- `not_started` condition: the old trigger fired after 20 minutes; 15 minutes
-- matches the new late_open threshold so the two kinds are consistent.

create or replace function admin_alerts(p_days integer default 1)
returns table (
  alert_key text,
  kind      text,
  severity  smallint,
  title     text,
  detail    text,
  at        timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  since      date       := (now() at time zone 'Asia/Manila')::date - (p_days - 1);
  today      date       := (now() at time zone 'Asia/Manila')::date;
  now_min    integer    := extract(hour from now() at time zone 'Asia/Manila') * 60
                         + extract(minute from now() at time zone 'Asia/Manila');
  today_dow  integer    := extract(dow from now() at time zone 'Asia/Manila');
  cleared    timestamptz;
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  select alerts_cleared_at into cleared from profiles where id = auth.uid();

  return query
  with raw as (

    -- Scans refused for being outside the laboratory.
    select
      'out_of_range'::text as kind, 2::smallint as severity,
      coalesce(p.full_name, 'Someone') || ' scanned from outside' as title,
      coalesce(r.code, 'a laboratory') || ' · ' ||
        coalesce(rj.distance_m::text || ' m away', 'location unknown') as detail,
      rj.at as at
    from scan_rejections rj
    left join profiles p on p.id = rj.student_id
    left join rooms r    on r.id = rj.room_id
    where rj.reason = 'out_of_range'
      and rj.at::date >= since

    union all

    -- An account used on a handset it is not registered to.
    select
      'device_mismatch', 2::smallint,
      coalesce(p.full_name, 'Someone') || ' scanned from another phone',
      'Account is registered to a different device',
      rj.at
    from scan_rejections rj
    left join profiles p on p.id = rj.student_id
    where rj.reason = 'device_mismatch'
      and rj.at::date >= since

    union all

    -- Arrivals well beyond the grace period, not merely a minute or two late.
    select
      'very_late', 1::smallint,
      p.full_name || ' arrived very late',
      sub.code || ' ' || sec.name || ' · ' ||
        (extract(epoch from (
          a.scanned_at at time zone 'Asia/Manila'
          - (cs.session_date + sec.start_time)
        )) / 60)::integer::text || ' minutes after the start',
      a.scanned_at
    from attendance a
    join class_sessions cs on cs.id = a.class_session_id
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = a.student_id
    where a.status = 'late'
      and cs.session_date >= since
      and a.scanned_at > (cs.session_date + sec.start_time) at time zone 'Asia/Manila'
                         + interval '45 minutes'

    union all

    -- Scheduled to have started by now, but nobody opened it.
    select
      'not_started', 2::smallint,
      sec.name || ' has not been opened',
      sub.code || ' · ' || p.full_name || ' · was due at ' ||
        to_char(sec.start_time, 'HH24:MI'),
      (today + sec.start_time) at time zone 'Asia/Manila'
    from sections sec
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = sec.teacher_id
    where sec.day_of_week = today_dow
      and now_min > (extract(hour from sec.start_time) * 60
                   + extract(minute from sec.start_time) + 15)
      and now_min < (extract(hour from sec.end_time) * 60
                   + extract(minute from sec.end_time))
      and not exists (
        select 1 from class_sessions cs
         where cs.section_id = sec.id and cs.session_date = today
      )

    union all

    -- Teacher opened the session 15+ minutes after the scheduled start time.
    select
      'late_open', 1::smallint,
      p.full_name || ' opened class late',
      sub.code || ' · ' || sec.name || ' · opened ' ||
        (extract(epoch from (
          cs.opened_at at time zone 'Asia/Manila'
          - (cs.session_date + sec.start_time)
        )) / 60)::integer::text || ' minutes after schedule',
      cs.opened_at
    from class_sessions cs
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = sec.teacher_id
    where cs.session_date >= since
      and cs.opened_at > (cs.session_date + sec.start_time) at time zone 'Asia/Manila'
                         + interval '15 minutes'

    union all

    -- Left open after the period ended, so the roll was never closed.
    select
      'left_open', 1::smallint,
      sec.name || ' is still open',
      sub.code || ' · ' || p.full_name || ' · ended at ' ||
        to_char(sec.end_time, 'HH24:MI'),
      cs.opened_at
    from class_sessions cs
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = sec.teacher_id
    where cs.status = 'open'
      and cs.session_date <= today
      and (
        cs.session_date < today
        or now_min > (extract(hour from sec.end_time) * 60
                    + extract(minute from sec.end_time))
      )
  )
  select
    md5(raw.kind || raw.at::text || raw.title),
    raw.kind, raw.severity, raw.title, raw.detail, raw.at
  from raw
  where (cleared is null or raw.at > cleared)
    and not exists (
      select 1 from dismissed_alerts d
       where d.admin_id = auth.uid()
         and d.alert_key = md5(raw.kind || raw.at::text || raw.title)
    )
  order by raw.severity desc, raw.at desc
  limit 50;
end;
$$;

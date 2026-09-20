-- Migration 031 — add actor_id/actor_role to admin_alerts and streak detection
--
-- Run in the Supabase SQL Editor after 030-late-open-alert.sql.
--
-- Two additions:
--   1. actor_id / actor_role: lets the UI link directly to the student or
--      teacher profile from the alert card.
--   2. streak alert kind: fires when a student has 2+ consecutive late or
--      absent sessions in the same section (30-day lookback, not tied to p_days).
--      severity 1 for 2 in a row, severity 2 for 3+.

drop function if exists admin_alerts(integer);

create or replace function admin_alerts(p_days integer default 1)
returns table (
  alert_key  text,
  kind       text,
  severity   smallint,
  title      text,
  detail     text,
  at         timestamptz,
  actor_id   uuid,
  actor_role text
)
language plpgsql stable security definer set search_path = public as $$
declare
  since      date        := (now() at time zone 'Asia/Manila')::date - (p_days - 1);
  today      date        := (now() at time zone 'Asia/Manila')::date;
  now_min    integer     := extract(hour from now() at time zone 'Asia/Manila') * 60
                          + extract(minute from now() at time zone 'Asia/Manila');
  today_dow  integer     := extract(dow from now() at time zone 'Asia/Manila');
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
      'out_of_range'::text as kind,
      2::smallint          as severity,
      coalesce(p.full_name, 'Someone') || ' scanned from outside' as title,
      coalesce(r.code, 'a laboratory') || ' · ' ||
        coalesce(rj.distance_m::text || ' m away', 'location unknown') as detail,
      rj.at                as at,
      rj.student_id        as actor_id,
      'student'::text      as actor_role
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
      rj.at,
      rj.student_id,
      'student'::text
    from scan_rejections rj
    left join profiles p on p.id = rj.student_id
    where rj.reason = 'device_mismatch'
      and rj.at::date >= since

    union all

    -- Arrivals well beyond the grace period.
    select
      'very_late', 1::smallint,
      p.full_name || ' arrived very late',
      sub.code || ' ' || sec.name || ' · ' ||
        (extract(epoch from (
          a.scanned_at at time zone 'Asia/Manila'
          - (cs.session_date + sec.start_time)
        )) / 60)::integer::text || ' minutes after the start',
      a.scanned_at,
      a.student_id,
      'student'::text
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
      (today + sec.start_time) at time zone 'Asia/Manila',
      p.id,
      'teacher'::text
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

    -- Teacher opened the session 15+ minutes after the scheduled start.
    select
      'late_open', 1::smallint,
      p.full_name || ' opened class late',
      sub.code || ' · ' || sec.name || ' · opened ' ||
        (extract(epoch from (
          cs.opened_at at time zone 'Asia/Manila'
          - (cs.session_date + sec.start_time)
        )) / 60)::integer::text || ' minutes after schedule',
      cs.opened_at,
      p.id,
      'teacher'::text
    from class_sessions cs
    join sections sec on sec.id = cs.section_id
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = sec.teacher_id
    where cs.session_date >= since
      and cs.opened_at > (cs.session_date + sec.start_time) at time zone 'Asia/Manila'
                         + interval '15 minutes'

    union all

    -- Left open after the period ended.
    select
      'left_open', 1::smallint,
      sec.name || ' is still open',
      sub.code || ' · ' || p.full_name || ' · ended at ' ||
        to_char(sec.end_time, 'HH24:MI'),
      cs.opened_at,
      p.id,
      'teacher'::text
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

    union all

    -- Students with 2+ consecutive late or absent sessions in the same section.
    -- Uses a 30-day lookback regardless of p_days, because streaks span days.
    select
      'streak',
      case when st.streak_len >= 3 then 2::smallint else 1::smallint end,
      p.full_name || ' has ' || st.streak_len::text || ' consecutive ' ||
        case
          when st.absent_count = 0 then 'late sessions'
          when st.late_count   = 0 then 'absences'
          else 'late/absent sessions'
        end,
      sub.code || ' · ' || sec.name || ' · ' || st.streak_len::text || ' in a row',
      (st.last_date + sec.start_time) at time zone 'Asia/Manila',
      p.id,
      'student'::text
    from (
      with ordered_att as (
        select
          a.student_id,
          cs.section_id,
          a.status,
          cs.session_date,
          row_number() over (
            partition by a.student_id, cs.section_id
            order by cs.session_date desc
          ) as rn
        from attendance a
        join class_sessions cs on cs.id = a.class_session_id
        where cs.session_date >= today - 30
      ),
      -- Position of the first 'present' when scanning newest-first.
      -- If no present exists in the window, treat it as 999.
      streak_break as (
        select
          student_id, section_id,
          coalesce(min(case when status = 'present' then rn end), 999) as first_ok_rn
        from ordered_att
        group by student_id, section_id
      )
      select
        o.student_id,
        o.section_id,
        count(*)                                        as streak_len,
        max(o.session_date)                             as last_date,
        count(*) filter (where o.status = 'late')      as late_count,
        count(*) filter (where o.status = 'absent')    as absent_count
      from ordered_att o
      join streak_break sb
        on sb.student_id = o.student_id and sb.section_id = o.section_id
      where o.rn < sb.first_ok_rn          -- only sessions before the first 'present'
        and o.status in ('late', 'absent')
      group by o.student_id, o.section_id
      having count(*) >= 2
    ) st
    join sections sec on sec.id  = st.section_id
    join subjects sub on sub.id  = sec.subject_id
    join profiles p   on p.id    = st.student_id
  )
  select
    md5(raw.kind || raw.at::text || raw.title),
    raw.kind, raw.severity, raw.title, raw.detail, raw.at,
    raw.actor_id, raw.actor_role
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

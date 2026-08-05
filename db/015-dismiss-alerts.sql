-- Migration 015 — dismissing alerts
--
-- Run in the Supabase SQL Editor after 014-admin-alerts.sql.

alter table profiles
  add column if not exists alerts_cleared_at timestamptz;

/**
 * Alerts an administrator has waved away individually.
 *
 * Alerts are computed, not stored, so they have no natural id. The key is a
 * hash of what makes one distinct — its kind, its timestamp and its wording.
 * Two different students scanning from outside at the same second still get
 * different keys, and the same alert recomputed a minute later gets the same
 * one.
 */
create table if not exists dismissed_alerts (
  admin_id  uuid not null references profiles(id) on delete cascade,
  alert_key text not null,
  at        timestamptz not null default now(),
  primary key (admin_id, alert_key)
);

alter table dismissed_alerts enable row level security;

create policy dismissed_alerts_own on dismissed_alerts for select
  using (admin_id = auth.uid());

create or replace function dismiss_alert(p_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  insert into dismissed_alerts (admin_id, alert_key)
  values (auth.uid(), p_key)
  on conflict do nothing;
end;
$$;

/** Clears everything currently showing, without listing it row by row. */
create or replace function clear_alerts()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  update profiles set alerts_cleared_at = now() where id = auth.uid();
end;
$$;

-- Rebuilt to carry a key and to respect dismissals.
drop function if exists admin_alerts(integer);

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
  since date := (now() at time zone 'Asia/Manila')::date - (p_days - 1);
  today date := (now() at time zone 'Asia/Manila')::date;
  now_min integer := extract(hour from now() at time zone 'Asia/Manila') * 60
                   + extract(minute from now() at time zone 'Asia/Manila');
  today_dow integer := extract(dow from now() at time zone 'Asia/Manila');
  cleared timestamptz;
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
                   + extract(minute from sec.start_time) + 20)
      and now_min < (extract(hour from sec.end_time) * 60
                   + extract(minute from sec.end_time))
      and not exists (
        select 1 from class_sessions cs
         where cs.section_id = sec.id and cs.session_date = today
      )

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

/**
 * Housekeeping. Dismissals only matter while the alert they hide is still
 * being computed, and nothing older than a week ever is.
 */
create or replace function purge_dismissed_alerts()
returns void
language sql security definer set search_path = public as $$
  delete from dismissed_alerts where at < now() - interval '7 days';
$$;

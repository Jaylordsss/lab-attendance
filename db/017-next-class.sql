-- Migration 017 — upcoming classes for the teacher reminder
--
-- Run in the Supabase SQL Editor after 016-profile-required.sql.

/**
 * A teacher's next class today, with how many minutes remain until it starts.
 *
 * Negative minutes mean it has already begun — which is the case worth
 * flagging hardest, because a class running with no session open is
 * attendance that is quietly not being recorded.
 *
 * Returns nothing once the class ends, so a finished period stops nagging.
 */
create or replace function my_next_class(p_user_id uuid)
returns table (
  section_id     uuid,
  section_name   text,
  subject_code   text,
  subject_title  text,
  room_code      text,
  room_name      text,
  start_time     time,
  end_time       time,
  minutes_until  integer,
  session_open   boolean,
  enrolled_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  today     date    := (now() at time zone 'Asia/Manila')::date;
  today_dow integer := extract(dow from now() at time zone 'Asia/Manila');
  now_min   integer := extract(hour from now() at time zone 'Asia/Manila') * 60
                     + extract(minute from now() at time zone 'Asia/Manila');
begin
  if auth.uid() <> p_user_id and not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      sec.id, sec.name, sub.code, sub.title,
      r.code, r.name, sec.start_time, sec.end_time,
      (extract(hour from sec.start_time) * 60
       + extract(minute from sec.start_time) - now_min)::integer,
      exists (
        select 1 from class_sessions cs
         where cs.section_id = sec.id
           and cs.session_date = today
           and cs.status = 'open'
      ),
      (select count(*) from enrollments e where e.section_id = sec.id)
    from sections sec
    join subjects sub on sub.id = sec.subject_id
    left join rooms r on r.id = sec.default_room_id
    where sec.teacher_id = p_user_id
      and sec.day_of_week = today_dow
      -- Still relevant until the period is over.
      and now_min < (extract(hour from sec.end_time) * 60
                   + extract(minute from sec.end_time))
    order by sec.start_time
    limit 1;
end;
$$;

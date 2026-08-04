-- General Science Laboratory Attendance System
-- Postgres / Supabase schema.
--
-- Principle: the database is the security boundary, not the API. Every policy
-- here should still hold if an attacker can send any request body they like.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles

create type user_role as enum ('admin', 'teacher', 'student');

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        user_role not null,
  full_name   text not null,
  created_at  timestamptz not null default now()
);

create table students (
  user_id          uuid primary key references profiles(id) on delete cascade,
  student_no       text not null unique,
  birthdate        date not null,
  -- RA 10173: personal data of minors. Encrypted at rest, decrypted only in
  -- admin-scoped views. Never returned to teachers or students.
  address_enc      bytea,
  guardian_name_enc bytea,
  guardian_phone_enc bytea,
  -- One account, one device. Set on first scan, cleared only by an admin.
  device_id        text,
  device_bound_at  timestamptz
);

create index on students (student_no);
-- Birthday lookup ignores year.
create index students_birthday_idx on students (extract(month from birthdate), extract(day from birthdate));

-- ---------------------------------------------------------------- academics

create table rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  qr_secret   text not null,          -- base64, server-side only
  lat         double precision,
  lng         double precision,
  geofence_m  integer not null default 60,
  allow_static_qr boolean not null default true
);

create table subjects (
  id     uuid primary key default gen_random_uuid(),
  code   text not null unique,
  title  text not null
);

create table sections (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references subjects(id) on delete restrict,
  teacher_id     uuid not null references profiles(id) on delete restrict,
  default_room_id uuid references rooms(id),
  name           text not null,
  day_of_week    smallint not null check (day_of_week between 0 and 6),
  start_time     time not null,
  end_time       time not null,
  grace_minutes  smallint not null default 15,
  unique (subject_id, name)
);

create table enrollments (
  section_id uuid not null references sections(id) on delete cascade,
  student_id uuid not null references students(user_id) on delete cascade,
  primary key (section_id, student_id)
);

-- ---------------------------------------------------------------- sessions

create type session_status as enum ('open', 'closed');

create table class_sessions (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references sections(id) on delete cascade,
  -- On the session, not the section, so labs can rotate rooms.
  room_id     uuid not null references rooms(id),
  qr_secret   text not null,          -- per-session, rotated each time
  session_date date not null,
  opened_at   timestamptz not null default now(),
  closed_at   timestamptz,
  status      session_status not null default 'open',
  unique (section_id, session_date)
);

-- At most one open session per room at a time.
create unique index one_open_session_per_room
  on class_sessions (room_id) where status = 'open';

-- ---------------------------------------------------------------- attendance

create type attendance_status as enum ('present', 'late', 'absent', 'excused');
create type scan_method as enum ('rotating', 'static', 'offline_sync', 'manual', 'auto_absent');

create table attendance (
  id               uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references class_sessions(id) on delete cascade,
  student_id       uuid not null references students(user_id) on delete cascade,
  status           attendance_status not null,
  method           scan_method not null,
  scanned_at       timestamptz not null default now(),
  device_id        text,
  lat              double precision,
  lng              double precision,
  override_reason  text,
  -- The real duplicate guard. Application logic is a courtesy; this is the rule.
  unique (class_session_id, student_id)
);

create index on attendance (student_id, scanned_at desc);

-- A manual override must justify itself.
alter table attendance add constraint manual_requires_reason
  check (method <> 'manual' or (override_reason is not null and length(override_reason) >= 10));

-- ---------------------------------------------------------------- audit

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid references profiles(id),
  action     text not null,
  target     text,
  detail     jsonb,
  ip         inet,
  user_agent text,
  at         timestamptz not null default now()
);

-- Append-only. No update or delete policy is ever granted below.
revoke update, delete on audit_log from authenticated, anon;

-- ================================================================ RLS

alter table profiles       enable row level security;
alter table students       enable row level security;
alter table rooms          enable row level security;
alter table subjects       enable row level security;
alter table sections       enable row level security;
alter table enrollments    enable row level security;
alter table class_sessions enable row level security;
alter table attendance     enable row level security;
alter table audit_log      enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function teaches_section(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sections where id = sid and teacher_id = auth.uid());
$$;

-- profiles: see yourself; admins see all.
create policy profiles_self on profiles for select
  using (id = auth.uid() or is_admin());

-- students: see your own record; admins see all. Teachers deliberately get
-- nothing here — they read names through a view that excludes PII columns.
create policy students_self on students for select
  using (user_id = auth.uid() or is_admin());

-- rooms: qr_secret is never selectable by clients. Expose a safe view instead
-- and keep the base table admin-only.
create policy rooms_admin on rooms for select using (is_admin());

create view rooms_public as
  select id, code, name, geofence_m, allow_static_qr from rooms;

create policy subjects_read on subjects for select using (auth.uid() is not null);

create policy sections_read on sections for select
  using (
    is_admin()
    or teacher_id = auth.uid()
    or exists (
      select 1 from enrollments e
      where e.section_id = sections.id and e.student_id = auth.uid()
    )
  );

create policy enrollments_read on enrollments for select
  using (student_id = auth.uid() or teaches_section(section_id) or is_admin());

create policy sessions_read on class_sessions for select
  using (
    is_admin()
    or teaches_section(section_id)
    or exists (
      select 1 from enrollments e
      where e.section_id = class_sessions.section_id and e.student_id = auth.uid()
    )
  );

-- Attendance: a student sees only their own rows. A teacher sees only their
-- own sections. Nobody writes here directly — inserts go through the scan
-- endpoint using the service role, which bypasses RLS by design.
create policy attendance_read on attendance for select
  using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from class_sessions cs
      where cs.id = attendance.class_session_id and teaches_section(cs.section_id)
    )
  );

create policy audit_read on audit_log for select using (is_admin());

-- ================================================================ helpers

create or replace function is_birthday_today(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students
    where user_id = uid
      and to_char(birthdate, 'MM-DD')
        = to_char((now() at time zone 'Asia/Manila')::date, 'MM-DD')
  );
$$;

-- Close a session and sweep the no-shows into absent rows in one transaction.
create or replace function close_session(sid uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  update class_sessions
     set status = 'closed', closed_at = now()
   where id = sid and status = 'open';

  insert into attendance (class_session_id, student_id, status, method)
  select sid, e.student_id, 'absent', 'auto_absent'
    from enrollments e
    join class_sessions cs on cs.id = sid
   where e.section_id = cs.section_id
  on conflict (class_session_id, student_id) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on rooms_public from anon;
grant select on rooms_public to authenticated;
-- =====================================================================
-- General Science Laboratory Attendance System
-- Complete database schema — replaces schema.sql, 002, 003 and 004.
--
-- Run this whole file in the Supabase SQL Editor. It drops and rebuilds
-- every object it owns, so it is safe to re-run while developing.
--
-- WARNING: this deletes all attendance data. Do not run it on a live term.
--
-- Principle: the database is the security boundary, not the API. Every
-- policy here should still hold if an attacker can send any request body.
-- =====================================================================

-- Supabase provisions pgcrypto into the `extensions` schema, not `public`.
-- Every function below that encrypts must therefore include `extensions`
-- in its search_path, or pgp_sym_encrypt resolves to nothing.
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------
-- Teardown, in dependency order
-- ------------------------------------------------------------------

drop view  if exists rooms_public cascade;

drop function if exists user_directory(text, text, text)        cascade;
drop function if exists department_list()                        cascade;
drop function if exists section_summary()                        cascade;
drop function if exists section_roster(uuid)                     cascade;
drop function if exists find_student_by_no(text)                 cascade;
drop function if exists student_details(uuid, text)              cascade;
drop function if exists create_student_record(uuid, text, date, text, text, text, text) cascade;
drop function if exists close_session(uuid)                      cascade;
drop function if exists is_birthday_today(uuid)                  cascade;
drop function if exists staff_directory()                        cascade;
drop function if exists teaches_section(uuid)                    cascade;
drop function if exists is_admin()                               cascade;
drop function if exists enforce_section_teacher()                cascade;

drop table if exists audit_log      cascade;
drop table if exists attendance     cascade;
drop table if exists class_sessions cascade;
drop table if exists enrollments    cascade;
drop table if exists sections       cascade;
drop table if exists subjects       cascade;
drop table if exists rooms          cascade;
drop table if exists students       cascade;
drop table if exists staff          cascade;
drop table if exists profiles       cascade;

drop type if exists attendance_status cascade;
drop type if exists scan_method       cascade;
drop type if exists session_status    cascade;
drop type if exists account_status    cascade;
drop type if exists user_role         cascade;

-- ------------------------------------------------------------------
-- Types
-- ------------------------------------------------------------------

create type user_role         as enum ('admin', 'teacher', 'student');
create type account_status    as enum ('active', 'suspended');
create type session_status    as enum ('open', 'closed');
create type attendance_status as enum ('present', 'late', 'absent', 'excused');
create type scan_method       as enum ('rotating', 'static', 'offline_sync', 'manual', 'auto_absent');

-- ------------------------------------------------------------------
-- People
-- ------------------------------------------------------------------

create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  role       user_role not null,
  full_name  text not null,
  status     account_status not null default 'active',
  -- Set when someone else issued the password. Cleared when the user picks
  -- their own; the app sends them to /account until then.
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create index profiles_role_idx on profiles (role);

-- Admins and teachers.
create table staff (
  user_id     uuid primary key references profiles(id) on delete cascade,
  faculty_id  text not null,
  department  text not null,
  contact_no  text,
  created_at  timestamptz not null default now()
);

-- Case-insensitive: T-2026-01 and t-2026-01 cannot both exist.
create unique index staff_faculty_id_idx on staff (lower(faculty_id));
create index staff_department_idx on staff (department);

-- Students. Guardian details and address are personal data of minors under
-- RA 10173 and are encrypted at rest — see create_student_record below.
create table students (
  user_id            uuid primary key references profiles(id) on delete cascade,
  student_no         text not null,
  birthdate          date not null,
  address_enc        bytea,
  guardian_name_enc  bytea,
  guardian_phone_enc bytea,
  -- One account, one device. Set on first scan, cleared only by an admin.
  device_id          text,
  device_bound_at    timestamptz
);

create unique index students_student_no_idx on students (upper(student_no));
-- Birthday lookup ignores the year.
create index students_birthday_idx
  on students (extract(month from birthdate), extract(day from birthdate));

-- ------------------------------------------------------------------
-- Academics
-- ------------------------------------------------------------------

create table rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  -- Signs this room's QR tokens. Server-side only; never selected by a client.
  qr_secret       text not null,
  lat             double precision,
  lng             double precision,
  geofence_m      integer not null default 60,
  allow_static_qr boolean not null default true
);

create table subjects (
  id    uuid primary key default gen_random_uuid(),
  code  text not null unique,
  title text not null
);

create table sections (
  id              uuid primary key default gen_random_uuid(),
  subject_id      uuid not null references subjects(id) on delete restrict,
  teacher_id      uuid not null references profiles(id) on delete restrict,
  default_room_id uuid references rooms(id),
  name            text not null,
  day_of_week     smallint not null check (day_of_week between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  grace_minutes   smallint not null default 15,
  unique (subject_id, name),
  check (end_time > start_time)
);

/**
 * A foreign key can point at profiles, but it cannot say "only teachers".
 * This trigger does. Without it an admin account can be assigned to a
 * section, and that section then never appears on any teacher's dashboard —
 * a silent failure that is hard to diagnose from the UI.
 */
create or replace function enforce_section_teacher()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from profiles
     where id = new.teacher_id and role = 'teacher'
  ) then
    raise exception 'sections.teacher_id must reference a profile with role = teacher';
  end if;
  return new;
end;
$$;

create trigger sections_teacher_must_be_teacher
  before insert or update of teacher_id on sections
  for each row execute function enforce_section_teacher();

create table enrollments (
  section_id uuid not null references sections(id) on delete cascade,
  student_id uuid not null references students(user_id) on delete cascade,
  primary key (section_id, student_id)
);

-- ------------------------------------------------------------------
-- Sessions and attendance
-- ------------------------------------------------------------------

create table class_sessions (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references sections(id) on delete cascade,
  -- On the session, not the section, so laboratories can rotate.
  room_id      uuid not null references rooms(id),
  qr_secret    text not null,
  session_date date not null,
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  status       session_status not null default 'open',
  unique (section_id, session_date)
);

-- Two open sessions in one room would make attendance ambiguous.
create unique index one_open_session_per_room
  on class_sessions (room_id) where status = 'open';

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
  unique (class_session_id, student_id),
  -- A manual override must justify itself.
  constraint manual_requires_reason check (
    method <> 'manual'
    or (override_reason is not null and length(override_reason) >= 10)
  )
);

create index attendance_student_idx on attendance (student_id, scanned_at desc);
create index attendance_session_idx on attendance (class_session_id);

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

create index audit_log_at_idx on audit_log (at desc);

-- ------------------------------------------------------------------
-- Helper functions — defined before the policies that use them
-- ------------------------------------------------------------------

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function teaches_section(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sections where id = sid and teacher_id = auth.uid()
  );
$$;

create or replace function is_birthday_today(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students
     where user_id = uid
       and to_char(birthdate, 'MM-DD')
         = to_char((now() at time zone 'Asia/Manila')::date, 'MM-DD')
  );
$$;

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table profiles       enable row level security;
alter table staff          enable row level security;
alter table students       enable row level security;
alter table rooms          enable row level security;
alter table subjects       enable row level security;
alter table sections       enable row level security;
alter table enrollments    enable row level security;
alter table class_sessions enable row level security;
alter table attendance     enable row level security;
alter table audit_log      enable row level security;

create policy profiles_read on profiles for select
  using (id = auth.uid() or is_admin());

create policy staff_read on staff for select
  using (user_id = auth.uid() or is_admin());

-- Teachers deliberately get nothing here. They read names through
-- section_roster(), which excludes every encrypted column.
create policy students_read on students for select
  using (user_id = auth.uid() or is_admin());

-- Teachers and students must be able to read a room's code and name — a
-- section page joins to it. But qr_secret must never reach a browser.
--
-- Row-level policies cannot express "every row, but not this column", so the
-- restriction is column-level: the select privilege is granted on the safe
-- columns only. A client asking for qr_secret is refused by Postgres itself.
-- The service role bypasses all of this, which is how the QR page still signs
-- codes server-side.
create policy rooms_read on rooms for select
  using (auth.uid() is not null);

revoke select on rooms from anon, authenticated;
grant select (id, code, name, geofence_m, allow_static_qr)
  on rooms to authenticated;

create policy subjects_read on subjects for select
  using (auth.uid() is not null);

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
       where e.section_id = class_sessions.section_id
         and e.student_id = auth.uid()
    )
  );

-- Nobody writes here directly. Scans go through the API using the service
-- role, which bypasses RLS by design after its own checks.
create policy attendance_read on attendance for select
  using (
    student_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from class_sessions cs
       where cs.id = attendance.class_session_id
         and teaches_section(cs.section_id)
    )
  );

create policy audit_read on audit_log for select using (is_admin());

-- Append-only.
revoke update, delete on audit_log from authenticated, anon;

-- ------------------------------------------------------------------
-- Student records and PII
-- ------------------------------------------------------------------

/**
 * Creates a student's record. The key comes from the server environment as
 * PII_KEY and is passed in per call — it is never stored in the database, so
 * a leaked dump on its own does not reveal guardian details.
 */
create or replace function create_student_record(
  p_user_id       uuid,
  p_student_no    text,
  p_birthdate     date,
  p_address       text,
  p_guardian_name text,
  p_guardian_no   text,
  p_key           text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into students (
    user_id, student_no, birthdate,
    address_enc, guardian_name_enc, guardian_phone_enc
  ) values (
    p_user_id, upper(p_student_no), p_birthdate,
    pgp_sym_encrypt(coalesce(p_address, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_name, ''), p_key),
    pgp_sym_encrypt(coalesce(p_guardian_no, ''), p_key)
  );
end;
$$;

/** Decrypted student record. Admin only — teachers cannot call this. */
create or replace function student_details(p_user_id uuid, p_key text)
returns table (
  student_no     text,
  full_name      text,
  birthdate      date,
  address        text,
  guardian_name  text,
  guardian_phone text
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select s.student_no, p.full_name, s.birthdate,
           pgp_sym_decrypt(s.address_enc, p_key),
           pgp_sym_decrypt(s.guardian_name_enc, p_key),
           pgp_sym_decrypt(s.guardian_phone_enc, p_key)
      from students s join profiles p on p.id = s.user_id
     where s.user_id = p_user_id;
end;
$$;

/**
 * Roster for one section: number, name and birthday only, no PII.
 * A teacher needs to know who is in their class, not where each child lives.
 */
create or replace function section_roster(p_section_id uuid)
returns table (
  user_id    uuid,
  student_no text,
  full_name  text,
  birthdate  date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or teaches_section(p_section_id)) then
    raise exception 'not permitted';
  end if;

  return query
    select s.user_id, s.student_no, p.full_name, s.birthdate
      from enrollments e
      join students s on s.user_id = e.student_id
      join profiles p on p.id = s.user_id
     where e.section_id = p_section_id
     order by p.full_name;
end;
$$;

create or replace function find_student_by_no(p_student_no text)
returns table (user_id uuid, student_no text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_admin() or exists (
    select 1 from profiles where id = auth.uid() and role = 'teacher'
  )) then
    raise exception 'not permitted';
  end if;

  return query
    select s.user_id, s.student_no, p.full_name
      from students s join profiles p on p.id = s.user_id
     where upper(s.student_no) = upper(p_student_no);
end;
$$;

-- ------------------------------------------------------------------
-- Sessions
-- ------------------------------------------------------------------

/**
 * Closes a session and sweeps every enrolled student who never scanned into
 * an absent row — in one transaction, so there is no moment where the class
 * is closed but attendance is incomplete.
 */
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

-- ------------------------------------------------------------------
-- Admin directories
-- ------------------------------------------------------------------

create or replace function staff_directory()
returns table (
  user_id    uuid,
  full_name  text,
  role       user_role,
  faculty_id text,
  department text,
  email      text
)
language sql stable security definer set search_path = public, auth as $$
  select s.user_id, p.full_name, p.role, s.faculty_id, s.department, u.email::text
    from staff s
    join profiles p on p.id = s.user_id
    join auth.users u on u.id = s.user_id
   where is_admin()
   order by p.full_name;
$$;

create or replace function user_directory(
  p_role       text default null,
  p_department text default null,
  p_search     text default null
)
returns table (
  user_id    uuid,
  full_name  text,
  role       user_role,
  identifier text,
  department text,
  email      text,
  status     text
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then
    raise exception 'not permitted';
  end if;

  return query
    select
      p.id, p.full_name, p.role,
      coalesce(st.faculty_id, s.student_no),
      st.department,
      case when p.role = 'student' then null else u.email::text end,
      case when p.must_change_password then 'temporary password' else 'active' end
    from profiles p
    left join staff st    on st.user_id = p.id
    left join students s  on s.user_id  = p.id
    left join auth.users u on u.id      = p.id
    where (p_role is null or p.role::text = p_role)
      and (p_department is null or st.department = p_department)
      and (
        p_search is null
        or p.full_name ilike '%' || p_search || '%'
        or coalesce(st.faculty_id, s.student_no) ilike '%' || p_search || '%'
      )
    order by p.role, p.full_name;
end;
$$;

create or replace function department_list()
returns table (department text)
language sql stable security definer set search_path = public as $$
  select distinct s.department from staff s where is_admin() order by 1;
$$;

create or replace function section_summary()
returns table (
  section_id    uuid,
  name          text,
  subject_code  text,
  room_code     text,
  teacher_name  text,
  day_of_week   smallint,
  start_time    time,
  end_time      time,
  student_count bigint
)
language sql stable security definer set search_path = public as $$
  select sec.id, sec.name, sub.code, r.code, p.full_name,
         sec.day_of_week, sec.start_time, sec.end_time,
         count(e.student_id)
    from sections sec
    join subjects sub on sub.id = sec.subject_id
    join profiles p   on p.id   = sec.teacher_id
    left join rooms r on r.id   = sec.default_room_id
    left join enrollments e on e.section_id = sec.id
   where is_admin()
   group by sec.id, sub.code, r.code, p.full_name
   order by sec.day_of_week, sec.start_time;
$$;

-- =====================================================================
-- After running this, recreate your admin at /setup.
-- =====================================================================

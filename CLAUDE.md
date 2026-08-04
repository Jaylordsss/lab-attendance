# General Science Laboratory Attendance System

## What this is

A PWA for a Philippine school. Students scan a QR code to mark attendance in a
science lab. Three roles: admin, teacher, student. ~1000 students/day.

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind
- Supabase (Postgres + Auth + Row Level Security)
- Vercel hosting, GitHub for version control
- `next-pwa` for installability and offline
- `@zxing/browser` for camera QR scanning
- `pdf-lib` for daily exports

Must remain portable to self-hosted Supabase on Hostinger later. Do not use
Vercel-proprietary storage or edge-only APIs.

## Core security model — read this before touching attendance code

**The QR code contains NO student data.** It only proves location and time.
Student identity comes from their authenticated session JWT.

Two QR tiers:

- **Tier A (rotating)** — rendered on the teacher's dashboard when they open a
  session. Payload `<sessionId>.<window>.<hmac>`, 30-second windows. This is the
  default and preferred path.
- **Tier B (static)** — printed sign at the room door. Payload
  `<roomId>.<hmac>`. Photographable, so it requires GPS geofence + strict device
  binding, and is recorded with `scan_method = 'static'` for audit.

Both are encoded as URLs (`https://<host>/s?t=...`) so a native camera app can
deep-link into the PWA.

### The seven checks

Every scan runs these in order, fail fast:

1. Session JWT valid → resolves `student_id`
2. HMAC signature valid
3. Time window fresh (current ±1 window)
4. A `class_session` is open for that section/room right now
5. Student is enrolled in that section
6. No existing attendance row (DB unique constraint is the real guard)
7. Device fingerprint matches the account's bound device

### Non-negotiables

- Room/session HMAC secrets live server-side only. Never in the client bundle,
  never in a QR payload, never in a `NEXT_PUBLIC_` env var.
- RLS is ON for every table. The API is not the security boundary; the database
  is. Assume an attacker can call any endpoint with any body.
- `students.address`, `guardian_name`, `guardian_phone` are personal data of
  minors under RA 10173 (Data Privacy Act of 2012). Encrypted at rest via
  pgcrypto. Never logged, never returned to a non-admin, never in a URL query.
- No selfie/photo capture. Biometric data on minors is a legal liability and a
  storage cost with no proportionate benefit.
- Every manual attendance override requires a reason and writes to `audit_log`.
- Connect to Postgres through Supavisor (transaction mode), never a direct
  connection. Serverless functions exhaust direct connections during class
  change rushes.

## Auth

Students log in with **student number + password**. Supabase Auth requires an
email, so synthesize `{student_no}@students.invalid` internally and never expose
or send mail to it. Teachers and admins use real email.

## Build order

Do not skip ahead. A cheatable system that looks authoritative is worse than
paper.

1. **Phase 1** — auth + roles, admin CSV import, teacher opens session and
   renders rotating QR, student scans, row saved.
2. **Phase 2** — RLS policies, device binding, geofence, audit log, unique
   constraints, PII encryption.
3. **Phase 3** — birthday greeting, offline queue, daily PDF cron, at-risk
   flagging, manual override.
4. **Phase 4** — equipment checkout, incident log, safety acknowledgment.

## Conventions

- Server-side Supabase client uses the service role key ONLY inside
  `app/api/**`. Never import it into a client component.
- All timestamps stored UTC, displayed Asia/Manila.
- Attendance status is derived, not user-set: `present` if
  `scanned_at <= start_time + grace_minutes`, else `late`. Enrolled students
  with no row when the session closes are batch-inserted as `absent`.


- Never construct a Supabase client, SDK, or any object requiring a secret at
  module scope in a route file. Next.js evaluates module scope at build time.
  Use a lazily-initialized getter cached in a module-level variable.
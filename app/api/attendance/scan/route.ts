import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  parseToken,
  verifySignature,
  windowIsFresh,
  windowIsFreshForOfflineSync,
} from "@/lib/qr-token";

/**
 * POST /api/attendance/scan
 *
 * The seven checks, in order, failing fast. Every rejection returns the same
 * shape and a deliberately vague message — we do not tell a probing client
 * which check failed, only the teacher's dashboard sees detail.
 */

export const runtime = "nodejs";

// Service role bypasses RLS. It must never be imported by a client component.
//
// Built lazily. Constructing at module scope makes Next.js require the key at
// BUILD time, which fails any deploy where the env vars are not present during
// the build step. This client is only ever used inside a request.
// Typed as the permissive default schema. Once the project stabilises, run
//   npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
// and change this to SupabaseClient<Database> for real column checking.
let _admin: SupabaseClient | null = null;

function getAdmin() {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set both in .env.local and in the Vercel project's Environment Variables.",
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

type Body = {
  token: string;
  deviceId: string;
  lat?: number;
  lng?: number;
  queuedAt?: string; // present only for offline replays
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.token || !body?.deviceId) return reject("bad_request");

  // Filled in as we learn them, so a rejection can be logged with whatever
  // context we had reached before failing.
  const ctx: {
    studentId?: string;
    sessionId?: string;
    roomId?: string;
    distanceM?: number;
  } = {};

  const deny = async (reason: string, code = 403) => {
    await logRejection(ctx, reason, body);
    return reject(reason, code);
  };

  // -- 1. Session JWT --------------------------------------------------
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return deny("unauthenticated", 401);

  const { data: userData, error: userErr } = await getAdmin().auth.getUser(jwt);
  if (userErr || !userData.user) return deny("unauthenticated", 401);
  const studentId = userData.user.id;
  ctx.studentId = studentId;

  // -- 2. Token structure ----------------------------------------------
  const parsed = parseToken(body.token);
  if (!parsed) return deny("invalid_code");

  const isOffline = Boolean(body.queuedAt);

  let sessionId: string;
  let method: "rotating" | "static" | "offline_sync";

  if (parsed.kind === "rotating") {
    const { data: cs } = await getAdmin()
      .from("class_sessions")
      .select("id, qr_secret, status")
      .eq("id", parsed.sessionId)
      .single();
    if (!cs) return deny("invalid_code");

    // -- 3. Signature + freshness --------------------------------------
    if (!verifySignature(parsed, cs.qr_secret)) return deny("invalid_code");

    const fresh = isOffline
      ? windowIsFreshForOfflineSync(parsed.window)
      : windowIsFresh(parsed.window);
    if (!fresh) return deny("code_expired");

    sessionId = cs.id;
    ctx.sessionId = cs.id as string;
    method = isOffline ? "offline_sync" : "rotating";
  } else {
    const { data: room } = await getAdmin()
      .from("rooms")
      .select("id, qr_secret, lat, lng, geofence_m, allow_static_qr")
      .eq("id", parsed.roomId)
      .single();
    if (!room || !room.allow_static_qr) return deny("invalid_code");
    ctx.roomId = room.id as string;
    if (!verifySignature(parsed, room.qr_secret)) return deny("invalid_code");

    // Resolve the open session first, so an out-of-range attempt is still
    // attached to the class the student was trying to join. Checking distance
    // before this would leave the most interesting rejections orphaned.
    const { data: open } = await getAdmin()
      .from("class_sessions")
      .select("id")
      .eq("room_id", room.id)
      .eq("status", "open")
      .maybeSingle();

    if (open) {
      sessionId = open.id;
      ctx.sessionId = open.id as string;
    }

    // Static codes are permanently photographable, so GPS is mandatory here.
    const distance = distanceFrom(body.lat, body.lng, room);
    ctx.distanceM = distance === null ? undefined : Math.round(distance);

    if (distance === null || distance > room.geofence_m) {
      return deny("out_of_range");
    }

    if (!open) return deny("no_open_session");

    sessionId = open.id;
    method = "static";
  }

  // -- 4. Session is open ----------------------------------------------
  const { data: session } = await getAdmin()
    .from("class_sessions")
    .select("id, section_id, status, sections(start_time, grace_minutes)")
    .eq("id", sessionId)
    .single();
  if (!session || (session.status !== "open" && !isOffline)) {
    return deny("no_open_session");
  }

  // -- 5. Enrolled in this section -------------------------------------
  const { data: enrolled } = await getAdmin()
    .from("enrollments")
    .select("student_id")
    .eq("section_id", session.section_id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!enrolled) return deny("not_enrolled");

  // -- 6. Device binding -----------------------------------------------
  const { data: student } = await getAdmin()
    .from("students")
    .select("device_id, birthdate")
    .eq("user_id", studentId)
    .single();
  if (!student) return deny("not_enrolled");

  if (student.device_id && student.device_id !== body.deviceId) {
    return deny("device_mismatch");
  }
  if (!student.device_id) {
    // First scan binds the device, whichever code was used.
    //
    // An earlier version refused to bind on a printed code, reasoning that a
    // shared phone could claim an unbound account. But reaching this line
    // already required the student's own password, an open session, an
    // enrolment in it and a position inside the geofence — and in a
    // printed-code deployment there is no other path, so the rule locked
    // every student out permanently.
    await getAdmin()
      .from("students")
      .update({ device_id: body.deviceId, device_bound_at: new Date().toISOString() })
      .eq("user_id", studentId);
  }

  // -- 7. Insert; the unique constraint is the real duplicate guard -----
  const section = (session as any).sections;
  const status = isLate(section?.start_time, section?.grace_minutes ?? 15)
    ? "late"
    : "present";

  const { error: insertErr } = await getAdmin().from("attendance").insert({
    class_session_id: sessionId,
    student_id: studentId,
    status,
    method,
    device_id: body.deviceId,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
  });

  if (insertErr) {
    if (insertErr.code === "23505") return deny("already_marked");
    return deny("server_error", 500);
  }

  const { data: birthday } = await getAdmin().rpc("is_birthday_today", { uid: studentId });

  await logAudit(req, studentId, "attendance_scan", sessionId);

  return NextResponse.json({ ok: true, status, isBirthday: Boolean(birthday) });
}

/* -------------------------------------------------------------------- */

function reject(reason: string, code = 403) {
  return NextResponse.json({ ok: false, reason }, { status: code });
}

function isLate(startTime?: string, graceMinutes = 15): boolean {
  if (!startTime) return false;
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  );
  const [h, m] = startTime.split(":").map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(h, m + graceMinutes, 0, 0);
  return now > cutoff;
}

/**
 * Metres between the phone and the laboratory, or null when either position
 * is unknown. Returning the distance rather than a yes/no lets the rejection
 * record how far away the student actually was.
 */
function distanceFrom(
  lat: number | undefined,
  lng: number | undefined,
  room: { lat: number | null; lng: number | null },
): number | null {
  if (room.lat == null || room.lng == null) return null;
  if (lat == null || lng == null) return null;

  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - room.lat);
  const dLng = toRad(lng - room.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(room.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Records a scan that did not become attendance. */
async function logRejection(
  ctx: {
    studentId?: string;
    sessionId?: string;
    roomId?: string;
    distanceM?: number;
  },
  reason: string,
  body: Body | null,
) {
  try {
    await getAdmin().from("scan_rejections").insert({
      class_session_id: ctx.sessionId ?? null,
      student_id: ctx.studentId ?? null,
      room_id: ctx.roomId ?? null,
      distance_m: ctx.distanceM ?? null,
      reason,
      device_id: body?.deviceId ?? null,
      lat: body?.lat ?? null,
      lng: body?.lng ?? null,
    });
  } catch {
    // Logging must never turn a clean rejection into a 500.
  }
}

async function logAudit(
  req: NextRequest,
  actorId: string,
  action: string,
  target: string,
) {
  await getAdmin().from("audit_log").insert({
    actor_id: actorId,
    action,
    target,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    user_agent: req.headers.get("user-agent"),
  });
}

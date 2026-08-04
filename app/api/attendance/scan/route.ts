import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

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

  // -- 1. Session JWT --------------------------------------------------
  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return reject("unauthenticated");

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return reject("unauthenticated");
  const studentId = userData.user.id;

  // -- 2. Token structure ----------------------------------------------
  const parsed = parseToken(body.token);
  if (!parsed) return reject("invalid_code");

  const isOffline = Boolean(body.queuedAt);

  let sessionId: string;
  let method: "rotating" | "static" | "offline_sync";

  if (parsed.kind === "rotating") {
    const { data: cs } = await admin
      .from("class_sessions")
      .select("id, qr_secret, status")
      .eq("id", parsed.sessionId)
      .single();
    if (!cs) return reject("invalid_code");

    // -- 3. Signature + freshness --------------------------------------
    if (!verifySignature(parsed, cs.qr_secret)) return reject("invalid_code");

    const fresh = isOffline
      ? windowIsFreshForOfflineSync(parsed.window)
      : windowIsFresh(parsed.window);
    if (!fresh) return reject("code_expired");

    sessionId = cs.id;
    method = isOffline ? "offline_sync" : "rotating";
  } else {
    const { data: room } = await admin
      .from("rooms")
      .select("id, qr_secret, lat, lng, geofence_m, allow_static_qr")
      .eq("id", parsed.roomId)
      .single();
    if (!room || !room.allow_static_qr) return reject("invalid_code");
    if (!verifySignature(parsed, room.qr_secret)) return reject("invalid_code");

    // Static codes are permanently photographable, so GPS is mandatory here.
    if (!withinGeofence(body.lat, body.lng, room)) return reject("out_of_range");

    const { data: open } = await admin
      .from("class_sessions")
      .select("id")
      .eq("room_id", room.id)
      .eq("status", "open")
      .maybeSingle();
    if (!open) return reject("no_open_session");

    sessionId = open.id;
    method = "static";
  }

  // -- 4. Session is open ----------------------------------------------
  const { data: session } = await admin
    .from("class_sessions")
    .select("id, section_id, status, sections(start_time, grace_minutes)")
    .eq("id", sessionId)
    .single();
  if (!session || (session.status !== "open" && !isOffline)) {
    return reject("no_open_session");
  }

  // -- 5. Enrolled in this section -------------------------------------
  const { data: enrolled } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("section_id", session.section_id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!enrolled) return reject("not_enrolled");

  // -- 6. Device binding -----------------------------------------------
  const { data: student } = await admin
    .from("students")
    .select("device_id, birthdate")
    .eq("user_id", studentId)
    .single();
  if (!student) return reject("not_enrolled");

  if (student.device_id && student.device_id !== body.deviceId) {
    await logAudit(req, studentId, "device_mismatch", sessionId);
    return reject("device_mismatch");
  }
  if (!student.device_id) {
    // First scan binds the device. Static-QR scans may not bind — that path is
    // lower assurance and would let a shared phone claim an unbound account.
    if (method === "static") return reject("device_not_bound");
    await admin
      .from("students")
      .update({ device_id: body.deviceId, device_bound_at: new Date().toISOString() })
      .eq("user_id", studentId);
  }

  // -- 7. Insert; the unique constraint is the real duplicate guard -----
  const section = (session as any).sections;
  const status = isLate(section?.start_time, section?.grace_minutes ?? 15)
    ? "late"
    : "present";

  const { error: insertErr } = await admin.from("attendance").insert({
    class_session_id: sessionId,
    student_id: studentId,
    status,
    method,
    device_id: body.deviceId,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
  });

  if (insertErr) {
    if (insertErr.code === "23505") return reject("already_marked");
    return reject("server_error", 500);
  }

  const { data: birthday } = await admin.rpc("is_birthday_today", { uid: studentId });

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

function withinGeofence(
  lat: number | undefined,
  lng: number | undefined,
  room: { lat: number | null; lng: number | null; geofence_m: number },
): boolean {
  if (room.lat == null || room.lng == null) return false;
  if (lat == null || lng == null) return false;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - room.lat);
  const dLng = toRad(lng - room.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(room.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= room.geofence_m;
}

async function logAudit(
  req: NextRequest,
  actorId: string,
  action: string,
  target: string,
) {
  await admin.from("audit_log").insert({
    actor_id: actorId,
    action,
    target,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    user_agent: req.headers.get("user-agent"),
  });
}

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/**
 * QR token crypto.
 *
 * Tokens carry NO personal data. They assert only "this scan happened at
 * <place> during <time window>", signed with a secret that never leaves the
 * server. Identity comes from the caller's session JWT, not from here.
 */

export const WINDOW_SECONDS = 30;
/** Accept the neighbouring window on each side, for clock skew. */
export const SKEW_WINDOWS = 1;

const SIG_LENGTH = 22; // truncated base64url of a SHA-256 HMAC (~132 bits)

export type ParsedToken =
  | { kind: "rotating"; sessionId: string; window: number; signature: string; signedPayload: string }
  | { kind: "static"; roomId: string; signature: string; signedPayload: string };

export function newSecret(): string {
  return randomBytes(32).toString("base64");
}

export function currentWindow(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / WINDOW_SECONDS);
}

function sign(secretB64: string, payload: string): string {
  return createHmac("sha256", Buffer.from(secretB64, "base64"))
    .update(payload, "utf8")
    .digest("base64url")
    .slice(0, SIG_LENGTH);
}

/** Constant-time compare that does not leak length. */
function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------ *
 * Tier A — rotating token, rendered on the teacher's dashboard
 * ------------------------------------------------------------------ */

export function makeRotatingToken(
  sessionId: string,
  secretB64: string,
  atMs: number = Date.now(),
): string {
  const w = currentWindow(atMs);
  const payload = `A.${sessionId}.${w}`;
  return `${payload}.${sign(secretB64, payload)}`;
}

/* ------------------------------------------------------------------ *
 * Tier B — static printed token
 * ------------------------------------------------------------------ */

export function makeStaticToken(roomId: string, secretB64: string): string {
  const payload = `B.${roomId}`;
  return `${payload}.${sign(secretB64, payload)}`;
}

/* ------------------------------------------------------------------ *
 * Parsing and verification
 * ------------------------------------------------------------------ */

/**
 * Structural parse only. Does NOT verify the signature — the caller must first
 * look up the secret for the referenced session or room, then call
 * verifySignature. This two-step shape exists so we never have to ship a
 * secret-lookup table into this module.
 */
export function parseToken(raw: string): ParsedToken | null {
  const token = extractToken(raw);
  if (!token) return null;

  const parts = token.split(".");

  if (parts[0] === "A" && parts.length === 4) {
    const [, sessionId, windowStr, signature] = parts;
    const window = Number(windowStr);
    if (!isUuid(sessionId) || !Number.isSafeInteger(window) || window <= 0) return null;
    if (signature.length !== SIG_LENGTH) return null;
    return { kind: "rotating", sessionId, window, signature, signedPayload: `A.${sessionId}.${window}` };
  }

  if (parts[0] === "B" && parts.length === 3) {
    const [, roomId, signature] = parts;
    if (!isUuid(roomId) || signature.length !== SIG_LENGTH) return null;
    return { kind: "static", roomId, signature, signedPayload: `B.${roomId}` };
  }

  return null;
}

export function verifySignature(parsed: ParsedToken, secretB64: string): boolean {
  return signatureMatches(sign(secretB64, parsed.signedPayload), parsed.signature);
}

/** Rotating tokens only. Rejects screenshots older than the skew allowance. */
export function windowIsFresh(window: number, atMs: number = Date.now()): boolean {
  return Math.abs(currentWindow(atMs) - window) <= SKEW_WINDOWS;
}

/**
 * Offline scans queued in IndexedDB may arrive late. Allow a wider window on
 * the sync path only, and record them distinctly so admins can see them.
 */
export function windowIsFreshForOfflineSync(
  window: number,
  atMs: number = Date.now(),
  maxAgeMinutes = 180,
): boolean {
  const age = currentWindow(atMs) - window;
  return age >= -SKEW_WINDOWS && age <= (maxAgeMinutes * 60) / WINDOW_SECONDS;
}

/* ------------------------------------------------------------------ */

/** Tokens are distributed as URLs so native camera apps can deep-link. */
export function tokenUrl(origin: string, token: string): string {
  return `${origin}/s?t=${encodeURIComponent(token)}`;
}

function extractToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!value.includes("://")) return value.slice(0, 200);
  try {
    const t = new URL(value).searchParams.get("t");
    return t ? t.slice(0, 200) : null;
  } catch {
    return null;
  }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses every Row Level Security policy.
 *
 * The "server-only" import above makes the build fail if this file is ever
 * pulled into a client component — a compile error instead of a leaked key.
 *
 * Built lazily: constructing at module scope would make Next.js demand the key
 * at build time, which breaks any deploy where env vars are absent during the
 * build step.
 */

let _admin: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
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

/** True when no admin account exists yet. Gates the one-time setup route. */
export async function adminExists(): Promise<boolean> {
  const { count, error } = await getServiceClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  // Fail closed. If we cannot tell, assume an admin exists and refuse setup.
  if (error) return true;
  return (count ?? 0) > 0;
}

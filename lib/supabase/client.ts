"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Uses the publishable key, which is safe to ship because Row
 * Level Security is what actually restricts access. Never import the service
 * key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

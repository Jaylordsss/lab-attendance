import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/cron/close-sessions
 *
 * Sweeps up sessions left open after their period ended. Vercel Cron calls
 * this; the CRON_SECRET check stops anyone else from doing so, since closing
 * a live class early would mark the whole room absent.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const { data, error } = await getServiceClient().rpc("close_stale_sessions");

  if (error) {
    console.error("close_stale_sessions:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ closed: data ?? 0 });
}

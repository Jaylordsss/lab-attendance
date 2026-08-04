import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Every admin page and every admin server action calls this first.
 *
 * The proxy already blocks unauthenticated requests, but that is convenience,
 * not security — middleware can be skipped. This is the check that counts, and
 * it runs on the server on every single request.
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

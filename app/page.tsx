import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { HOME_FOR_ROLE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Root is a router, not a page. Signed-in users go to their dashboard;
 * everyone else goes to sign in.
 */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? HOME_FOR_ROLE[user.role] : "/login");
}

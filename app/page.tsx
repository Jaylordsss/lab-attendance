import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { HOME_FOR_ROLE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Root is a router, not a page. Signed-in users go to their dashboard;
 * everyone else goes to sign in.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }
  redirect(HOME_FOR_ROLE[user.role]);
}
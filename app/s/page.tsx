import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Deep-link target for the printed QR code.
 *
 * A phone's native camera app opens the URL rather than handing the text to
 * our page, so this route catches it, makes sure the person is signed in, and
 * forwards the token to the scan screen.
 */
export default async function ScanLink({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/s?t=${t ?? ""}`)}`);
  }
  if (user.role !== "student") redirect("/");

  redirect(`/student?t=${encodeURIComponent(t ?? "")}`);
}

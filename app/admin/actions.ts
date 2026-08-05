"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function dismissAlert(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("alertKey") ?? "");
  if (!key) return;

  const supabase = await createClient();
  await supabase.rpc("dismiss_alert", { p_key: key });

  revalidatePath("/admin");
}

export async function clearAlerts() {
  await requireAdmin();

  const supabase = await createClient();
  await supabase.rpc("clear_alerts");

  // Cheap enough to run here rather than schedule: dismissals only matter
  // while the alert they hide is still being computed.
  await getServiceClient().rpc("purge_dismissed_alerts");

  revalidatePath("/admin");
}

"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { newSecret } from "@/lib/qr-token";

export type RoomState = { error: string | null; success: string | null };

export async function createRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const admin = await requireAdmin();

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const geofence = Number(formData.get("geofence") ?? 60);
  const lat = numOrNull(formData.get("lat"));
  const lng = numOrNull(formData.get("lng"));
  const allowStatic = formData.get("allowStatic") === "on";

  if (!code || !name) return fail("Give the laboratory a code and a name.");
  if (!/^[A-Z0-9-]{2,12}$/.test(code)) {
    return fail("Code must be 2–12 letters, numbers or dashes.");
  }
  if (!Number.isFinite(geofence) || geofence < 10 || geofence > 500) {
    return fail("Geofence radius must be between 10 and 500 metres.");
  }
  if (allowStatic && (lat === null || lng === null)) {
    return fail(
      "Printed QR needs coordinates — without them the geofence can't be checked.",
    );
  }

  const supabase = getServiceClient();

  // Generated server-side and never sent to a browser. This is what signs the
  // room's QR tokens.
  const { error } = await supabase.from("rooms").insert({
    code,
    name,
    qr_secret: newSecret(),
    lat,
    lng,
    geofence_m: geofence,
    allow_static_qr: allowStatic,
  });

  if (error) {
    return fail(
      error.code === "23505"
        ? `A laboratory with code ${code} already exists.`
        : "Couldn't save the laboratory. Try again.",
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "room_created",
    target: code,
  });

  revalidatePath("/admin/rooms");
  return { error: null, success: `${code} added.` };
}

export async function setStaticQr(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const enable = formData.get("enable") === "true";

  const supabase = getServiceClient();
  await supabase.from("rooms").update({ allow_static_qr: enable }).eq("id", id);
  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: enable ? "static_qr_enabled" : "static_qr_disabled",
    target: id,
  });

  revalidatePath("/admin/rooms");
}

function fail(error: string): RoomState {
  return { error, success: null };
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

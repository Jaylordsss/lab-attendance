"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { newSecret } from "@/lib/qr-token";

export type RoomState = { error: string | null; success: string | null };

const CODE = /^[A-Z0-9-]{2,12}$/;

const ok = (success: string): RoomState => ({ error: null, success });
const fail = (error: string): RoomState => ({ error, success: null });

function readForm(formData: FormData) {
  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? "").trim(),
    geofence: Number(formData.get("geofence") ?? 60),
    lat: numOrNull(formData.get("lat")),
    lng: numOrNull(formData.get("lng")),
    allowStatic: formData.get("allowStatic") === "on",
  };
}

function validate(v: ReturnType<typeof readForm>): string | null {
  if (!v.code || !v.name) return "Give the laboratory a code and a name.";
  if (!CODE.test(v.code)) {
    return "Code must be 2–12 letters, numbers or dashes.";
  }
  if (!Number.isFinite(v.geofence) || v.geofence < 10 || v.geofence > 500) {
    return "Geofence radius must be between 10 and 500 metres.";
  }
  if (v.allowStatic && (v.lat === null || v.lng === null)) {
    return "Printed QR needs coordinates — without them the geofence can't be checked.";
  }
  return null;
}

export async function createRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const admin = await requireAdmin();
  const v = readForm(formData);

  const problem = validate(v);
  if (problem) return fail(problem);

  const supabase = getServiceClient();

  // Generated server-side and never sent to a browser. This is what signs the
  // room's QR tokens.
  const { error } = await supabase.from("rooms").insert({
    code: v.code,
    name: v.name,
    qr_secret: newSecret(),
    lat: v.lat,
    lng: v.lng,
    geofence_m: v.geofence,
    allow_static_qr: v.allowStatic,
  });

  if (error) {
    return fail(
      error.code === "23505"
        ? `A laboratory with code ${v.code} already exists.`
        : "Couldn't save the laboratory. Try again.",
    );
  }

  await audit(admin.id, "room_created", v.code, {});
  revalidatePath("/admin/rooms");
  return ok(`${v.code} added.`);
}

export async function updateRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const v = readForm(formData);

  if (!id) return fail("Missing laboratory.");

  const problem = validate(v);
  if (problem) return fail(problem);

  const supabase = getServiceClient();

  // qr_secret is deliberately untouched. Rotating it would invalidate every
  // printed sheet already on a door.
  const { error } = await supabase
    .from("rooms")
    .update({
      code: v.code,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      geofence_m: v.geofence,
      allow_static_qr: v.allowStatic,
    })
    .eq("id", id);

  if (error) {
    return fail(
      error.code === "23505"
        ? `A laboratory with code ${v.code} already exists.`
        : "Couldn't save the changes. Try again.",
    );
  }

  await audit(admin.id, "room_updated", id, { code: v.code });
  revalidatePath("/admin/rooms");
  revalidatePath(`/admin/rooms/${id}`);
  return ok("Saved.");
}

/**
 * Issues a new signing secret, which invalidates every printed sheet for this
 * laboratory at once. The reason to do it is a leaked photograph of the code
 * circulating among students.
 */
export async function rotateSecret(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Missing laboratory.");

  const { error } = await getServiceClient()
    .from("rooms")
    .update({ qr_secret: newSecret() })
    .eq("id", id);

  if (error) return fail("Couldn't rotate the code. Try again.");

  await audit(admin.id, "room_secret_rotated", id, {});
  revalidatePath(`/admin/rooms/${id}`);
  return ok("New code generated. Print and replace the sheet on the door.");
}

export async function deleteRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!id) return fail("Missing laboratory.");

  const supabase = getServiceClient();

  // Attendance rows reference the session, which references the room. Deleting
  // a laboratory that has ever held a class would take that history with it,
  // so it is refused rather than cascaded.
  const { count: sessions } = await supabase
    .from("class_sessions")
    .select("id", { count: "exact", head: true })
    .eq("room_id", id);

  if ((sessions ?? 0) > 0) {
    return fail(
      `${code} has attendance history and can't be deleted. Turn off its printed QR instead.`,
    );
  }

  const { count: sections } = await supabase
    .from("sections")
    .select("id", { count: "exact", head: true })
    .eq("default_room_id", id);

  if ((sections ?? 0) > 0) {
    return fail(
      `${sections} section${sections === 1 ? "" : "s"} still use ${code}. Move them first.`,
    );
  }

  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return fail("Couldn't delete the laboratory.");

  await audit(admin.id, "room_deleted", code, {});
  revalidatePath("/admin/rooms");
  return ok(`${code} deleted.`);
}

export async function setStaticQr(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const enable = formData.get("enable") === "true";

  const supabase = getServiceClient();
  await supabase.from("rooms").update({ allow_static_qr: enable }).eq("id", id);
  await audit(
    admin.id,
    enable ? "static_qr_enabled" : "static_qr_disabled",
    id,
    {},
  );

  revalidatePath("/admin/rooms");
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function audit(
  actorId: string,
  action: string,
  target: string,
  detail: Record<string, unknown>,
) {
  await getServiceClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target, detail });
}

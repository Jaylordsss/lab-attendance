"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type SubjectState = { error: string | null; success: string | null };

const CODE = /^[A-Z0-9- ]{2,20}$/;

const ok = (success: string): SubjectState => ({ error: null, success });
const fail = (error: string): SubjectState => ({ error, success: null });

export async function createSubject(
  _prev: SubjectState,
  formData: FormData,
): Promise<SubjectState> {
  const admin = await requireAdmin();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();

  if (!code || !title) return fail("Give the subject a code and a title.");
  if (!CODE.test(code)) {
    return fail("Code must be 2–20 letters, numbers, spaces or dashes.");
  }

  const { error } = await getServiceClient()
    .from("subjects")
    .insert({ code, title });

  if (error) {
    return fail(
      error.code === "23505"
        ? `Subject ${code} already exists.`
        : "Couldn't save the subject.",
    );
  }

  await audit(admin.id, "subject_created", code, {});
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/sections");
  return ok(`${code} added.`);
}

export async function updateSubject(
  _prev: SubjectState,
  formData: FormData,
): Promise<SubjectState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const title = String(formData.get("title") ?? "").trim();

  if (!id) return fail("Missing subject.");
  if (!code || !title) return fail("Give the subject a code and a title.");
  if (!CODE.test(code)) {
    return fail("Code must be 2–20 letters, numbers, spaces or dashes.");
  }

  const { error } = await getServiceClient()
    .from("subjects")
    .update({ code, title })
    .eq("id", id);

  if (error) {
    return fail(
      error.code === "23505"
        ? `Subject ${code} already exists.`
        : "Couldn't save the changes.",
    );
  }

  await audit(admin.id, "subject_updated", id, { code });
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/sections");
  return ok("Saved.");
}

export async function deleteSubject(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!id) return;

  const supabase = getServiceClient();

  // Sections reference the subject with on delete restrict, so this would
  // fail anyway — checking first turns a database error into an explanation.
  const { count } = await supabase
    .from("sections")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", id);

  if ((count ?? 0) > 0) return;

  await supabase.from("subjects").delete().eq("id", id);
  await audit(admin.id, "subject_deleted", code, {});
  revalidatePath("/admin/subjects");
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

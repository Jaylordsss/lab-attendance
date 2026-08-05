"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export type DeptState = { error: string | null; success: string | null };

function refresh() {
  revalidatePath("/admin/departments");
  revalidatePath("/admin/teachers");
  revalidatePath("/admin/users");
}

/** Codes are stored uppercase so lookups and display are predictable. */
function normalizeCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

const CODE_PATTERN = /^[A-Z0-9-]{2,10}$/;

export async function createDepartment(
  _prev: DeptState,
  formData: FormData,
): Promise<DeptState> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));

  if (!name) return fail("Enter a department name.");
  if (name.length > 60) return fail("Keep the name under 60 characters.");
  if (!CODE_PATTERN.test(code)) {
    return fail("Short name must be 2–10 letters, numbers or dashes.");
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from("departments").insert({ name, code });

  if (error) {
    return fail(
      error.code === "23505"
        ? `${name} or ${code} already exists.`
        : "Couldn't save that department.",
    );
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "department_created",
    target: name,
    detail: { code },
  });

  refresh();
  return ok(`${code} — ${name} added.`);
}

export async function renameDepartment(
  _prev: DeptState,
  formData: FormData,
): Promise<DeptState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const oldName = String(formData.get("oldName") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = normalizeCode(String(formData.get("code") ?? ""));

  if (!id || !name) return fail("Enter a name.");
  if (!CODE_PATTERN.test(code)) {
    return fail("Short name must be 2–10 letters, numbers or dashes.");
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("departments")
    .update({ name, code })
    .eq("id", id);

  if (error) {
    return fail(
      error.code === "23505"
        ? `${name} or ${code} already exists.`
        : "Couldn't rename that department.",
    );
  }

  // staff.department stores the name, not a foreign key, so existing staff
  // have to be carried across or they end up pointing at a department that no
  // longer appears in any dropdown.
  if (name !== oldName) {
    await supabase
      .from("staff")
      .update({ department: name })
      .eq("department", oldName);
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "department_renamed",
    target: id,
    detail: { from: oldName, to: name, code },
  });

  refresh();
  return ok(`Saved ${code} — ${name}.`);
}

export async function deleteDepartment(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");

  const supabase = getServiceClient();

  // Refuse while anyone is still in it. Deleting would leave those staff
  // pointing at a department that is in no dropdown, which is worse than
  // making the admin move them first.
  const { count } = await supabase
    .from("staff")
    .select("user_id", { count: "exact", head: true })
    .eq("department", name);

  if ((count ?? 0) > 0) return;

  await supabase.from("departments").delete().eq("id", id);
  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "department_deleted",
    target: name,
  });

  refresh();
}

function ok(success: string): DeptState {
  return { error: null, success };
}
function fail(error: string): DeptState {
  return { error, success: null };
}

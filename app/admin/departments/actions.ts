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

export async function createDepartment(
  _prev: DeptState,
  formData: FormData,
): Promise<DeptState> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Enter a department name.", success: null };
  if (name.length > 60) {
    return { error: "Keep the name under 60 characters.", success: null };
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from("departments").insert({ name });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `${name} already exists.`
          : "Couldn't save that department.",
      success: null,
    };
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "department_created",
    target: name,
  });

  refresh();
  return { error: null, success: `${name} added.` };
}

export async function renameDepartment(
  _prev: DeptState,
  formData: FormData,
): Promise<DeptState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const oldName = String(formData.get("oldName") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id || !name) return { error: "Enter a name.", success: null };

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("departments")
    .update({ name })
    .eq("id", id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? `${name} already exists.`
          : "Couldn't rename that department.",
      success: null,
    };
  }

  // staff.department stores the name, not a foreign key, so existing staff
  // have to be carried across or they end up pointing at a department that no
  // longer appears in any dropdown.
  await supabase
    .from("staff")
    .update({ department: name })
    .eq("department", oldName);

  await supabase.from("audit_log").insert({
    actor_id: admin.id,
    action: "department_renamed",
    target: id,
    detail: { from: oldName, to: name },
  });

  refresh();
  return { error: null, success: `Renamed to ${name}.` };
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

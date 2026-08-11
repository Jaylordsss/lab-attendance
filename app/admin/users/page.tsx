import Link from "next/link";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin-ui";
import DataTable from "@/components/data-table";
import Filters from "./filters";
import IdEditor from "./id-editor";
import UserActions from "./user-actions";
import AccountControls from "./account-controls";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  full_name: string;
  role: string;
  identifier: string | null;
  department: string | null;
  email: string | null;
  status: string;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; department?: string; q?: string }>;
}) {
  const { role, department, q } = await searchParams;
  const me = await getCurrentUser();
  const supabase = await createClient();

  const [usersRes, deptRes] = await Promise.all([
    supabase.rpc("user_directory", {
      p_role: role || null,
      p_department: department || null,
      p_search: q || null,
    }),
    supabase.rpc("department_list"),
  ]);

  if (usersRes.error) console.error("user_directory:", usersRes.error.message);

  const users = (usersRes.data ?? []) as Row[];
  const deptRows = (deptRes.data ?? []) as {
    department: string;
    code: string;
  }[];
  const departments = deptRows.map((d) => d.department);

  // Full names run long. The short code keeps a row readable, with the full
  // name still available on hover.
  const codeFor = new Map(deptRows.map((d) => [d.department, d.code]));

  return (
    <>
      <PageHeader eyebrow="Admin" title="All users">
        Tap a name for their record. Guardian details and addresses are not
        shown here.
      </PageHeader>

      <Filters
        departments={departments}
        role={role ?? ""}
        department={department ?? ""}
        q={q ?? ""}
      />

      <div className="mt-6">
        <DataTable
          empty="No accounts match those filters."
          caption={`${users.length} ${users.length === 1 ? "account" : "accounts"}`}
          columns={[
            { head: "Name" },
            { head: "ID number" },
            { head: "Role" },
            { head: "Department" },
            { head: "Status" },
            { head: "Password" },
            { head: "Account" },
          ]}
          rows={users.map((u) => ({
            key: u.user_id,
            cells: [
              <div key="name">
                <Link
                  href={`/admin/users/${u.user_id}`}
                  className="underline underline-offset-4 hover:text-[#0B6E5F]"
                >
                  {u.full_name}
                </Link>
                {u.email && (
                  <span className="block text-xs font-normal text-[#5A6B7A] break-all">
                    {u.email}
                  </span>
                )}
              </div>,

              <IdEditor
                key="id"
                userId={u.user_id}
                role={u.role}
                identifier={u.identifier}
                department={u.department}
                departments={departments}
              />,

              <span
                key="role"
                className="text-xs uppercase tracking-[0.1em] text-[#5A6B7A]"
              >
                {u.role}
              </span>,

              u.department ? (
                <span key="dept" className="font-mono" title={u.department}>
                  {codeFor.get(u.department) ?? u.department}
                </span>
              ) : (
                <span key="dept" className="text-[#B4BFC8]">—</span>
              ),

              <span
                key="status"
                className="text-xs"
                style={{
                  color: u.status === "active" ? "#5A6B7A" : "#A8321F",
                }}
              >
                {u.status}
              </span>,

              <UserActions
                key="pw"
                userId={u.user_id}
                name={u.full_name}
                isStudent={u.role === "student"}
              />,

              <AccountControls
                key="acct"
                userId={u.user_id}
                name={u.full_name}
                suspended={u.status === "suspended"}
                isSelf={u.user_id === me?.id}
              />,
            ],
          }))}
        />
      </div>
    </>
  );
}

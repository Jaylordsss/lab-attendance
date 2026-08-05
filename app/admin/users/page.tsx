import { createClient } from "@/lib/supabase/server";
import { PageHeader, Empty, Th, Td } from "@/components/admin-ui";
import Filters from "./filters";
import IdEditor from "./id-editor";
import UserActions from "./user-actions";

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

  // Full names run long. Showing the short code keeps the row readable, with
  // the full name still available on hover.
  const codeFor = new Map(deptRows.map((d) => [d.department, d.code]));

  return (
    <>
      <PageHeader eyebrow="Admin" title="All users">
        Everyone with an account. Guardian details and addresses are not shown
        here — open a student's record for those.
      </PageHeader>

      <Filters
        departments={departments}
        role={role ?? ""}
        department={department ?? ""}
        q={q ?? ""}
      />

      {users.length === 0 ? (
        <div className="mt-6">
          <Empty>No accounts match those filters.</Empty>
        </div>
      ) : (
        <div className="mt-6 bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8ED]">
                <Th>Name</Th>
                <Th>ID number</Th>
                <Th>Role</Th>
                <Th>Department</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-b border-[#F0F3F5]">
                  <Td>
                    <span className="block">{u.full_name}</span>
                    {u.email && (
                      <span className="block text-xs text-[#5A6B7A]">
                        {u.email}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <IdEditor
                      userId={u.user_id}
                      role={u.role}
                      identifier={u.identifier}
                      department={u.department}
                      departments={departments}
                    />
                  </Td>
                  <Td>
                    <span className="text-xs uppercase tracking-[0.1em] text-[#5A6B7A]">
                      {u.role}
                    </span>
                  </Td>
                  <Td>
                    {u.department ? (
                      <span
                        className="font-mono"
                        title={u.department}
                      >
                        {codeFor.get(u.department) ?? u.department}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <span
                      className="text-xs"
                      style={{
                        color: u.status === "active" ? "#5A6B7A" : "#A8321F",
                      }}
                    >
                      {u.status}
                    </span>
                  </Td>
                  <Td>
                    <UserActions
                      userId={u.user_id}
                      name={u.full_name}
                      isStudent={u.role === "student"}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-[#5A6B7A]">
            {users.length} {users.length === 1 ? "account" : "accounts"}
          </p>
        </div>
      )}
    </>
  );
}

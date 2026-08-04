import { createClient } from "@/lib/supabase/server";
import { PageHeader, Empty, Th, Td } from "@/components/admin-ui";
import { resetPassword } from "@/app/admin/teachers/actions";
import Filters from "./filters";

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

  const users = (usersRes.data ?? []) as Row[];
  const departments = ((deptRes.data ?? []) as { department: string }[]).map(
    (d) => d.department,
  );

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
        <Empty>No accounts match those filters.</Empty>
      ) : (
        <div className="mt-6 bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8ED]">
                <Th>Name</Th>
                <Th>ID</Th>
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
                      <span className="block text-xs text-[#5A6B7A]">{u.email}</span>
                    )}
                  </Td>
                  <Td><span className="font-mono">{u.identifier ?? "—"}</span></Td>
                  <Td>
                    <span className="text-xs uppercase tracking-[0.1em] text-[#5A6B7A]">
                      {u.role}
                    </span>
                  </Td>
                  <Td>{u.department ?? "—"}</Td>
                  <Td>
                    <span
                      className="text-xs"
                      style={{ color: u.status === "active" ? "#5A6B7A" : "#A8321F" }}
                    >
                      {u.status}
                    </span>
                  </Td>
                  <Td>
                    <form action={resetPassword}>
                      <input type="hidden" name="userId" value={u.user_id} />
                      <button
                        type="submit"
                        className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
                      >
                        Reset password
                      </button>
                    </form>
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

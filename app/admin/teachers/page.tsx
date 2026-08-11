import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin-ui";
import DataTable from "@/components/data-table";
import TeacherForm from "./form";

export const dynamic = "force-dynamic";

type StaffRow = {
  user_id: string;
  full_name: string;
  role: string;
  faculty_id: string;
  department: string;
  email: string;
};

export default async function TeachersPage() {
  const supabase = await createClient();

  const [staffRes, deptRes] = await Promise.all([
    supabase.rpc("staff_directory"),
    supabase.rpc("department_list"),
  ]);

  const staff = (staffRes.data ?? []) as StaffRow[];
  const deptRows = (deptRes.data ?? []) as {
    department: string;
    code: string;
  }[];
  const codeFor = new Map(deptRows.map((d) => [d.department, d.code]));

  return (
    <>
      <PageHeader eyebrow="Admin" title="Teachers">
        Accounts are created here, never self-registered. A temporary password
        is shown once — pass it on, and the teacher chooses their own at first
        sign-in.
      </PageHeader>

      {deptRows.length === 0 && (
        <p className="mb-6 text-sm border-l-2 border-[#A8321F] pl-3 text-[#A8321F]">
          No departments exist yet.{" "}
          <Link href="/admin/departments" className="underline underline-offset-4">
            Add one first
          </Link>
          .
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          <DataTable
            empty="No staff accounts yet besides your own."
            columns={[
              { head: "Name" },
              { head: "Faculty ID" },
              { head: "Department" },
            ]}
            rows={staff.map((p) => ({
              key: p.user_id,
              cells: [
                <div key="name">
                  <Link
                    href={`/admin/users/${p.user_id}`}
                    className="underline underline-offset-4 hover:text-[#0B6E5F]"
                  >
                    {p.full_name}
                  </Link>
                  <span className="block text-xs font-normal text-[#5A6B7A] break-all">
                    {p.email}
                  </span>
                </div>,
                <span key="fid" className="font-mono">
                  {p.faculty_id}
                </span>,
                <span key="dept" title={p.department} className="font-mono">
                  {codeFor.get(p.department) ?? p.department}
                </span>,
              ],
            }))}
          />
        </section>

        <Card>
          <TeacherForm departments={deptRows} />
        </Card>
      </div>
    </>
  );
}

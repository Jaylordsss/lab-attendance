import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { formatPhPhone } from "@/lib/auth";
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
  const departments = ((deptRes.data ?? []) as { department: string }[]).map(
    (d) => d.department,
  );

  return (
    <>
      <PageHeader eyebrow="Admin" title="Teachers">
        Accounts are created here, never self-registered. A temporary password
        is shown once — pass it on, and the teacher chooses their own at first
        sign-in.
      </PageHeader>

      {departments.length === 0 && (
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
          {staff.length === 0 ? (
            <Empty>No staff accounts yet besides your own.</Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Name</Th>
                    <Th>Faculty ID</Th>
                    <Th>Department</Th>
                    <Th>Role</Th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((person) => (
                    <tr key={person.user_id} className="border-b border-[#F0F3F5]">
                      <Td>
                        <span className="block">{person.full_name}</span>
                        <span className="block text-xs text-[#5A6B7A]">
                          {person.email}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono">{person.faculty_id}</span>
                      </Td>
                      <Td>{person.department}</Td>
                      <Td>
                        <span className="text-xs uppercase tracking-[0.1em] text-[#5A6B7A]">
                          {person.role}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card>
          <TeacherForm departments={departments} />
        </Card>
      </div>
    </>
  );
}

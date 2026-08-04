import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
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
  const { data } = await supabase.rpc("staff_directory");
  const staff = (data ?? []) as StaffRow[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Teachers">
        Accounts are created here, never self-registered. A temporary password
        is shown once — pass it on, and have the teacher change it after their
        first sign-in.
      </PageHeader>

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
          <TeacherForm />
        </Card>
      </div>
    </>
  );
}

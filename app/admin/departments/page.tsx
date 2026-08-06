import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { deleteDepartment } from "./actions";
import ConfirmDelete from "@/components/confirm-delete";
import DeptForm from "./form";
import RenameCell from "./rename-cell";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  code: string;
  faculty_count: number;
  student_count: number;
};

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("department_summary");

  if (error) console.error("department_summary:", error.message);

  const departments = (data ?? []) as Row[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Departments">
        Whatever you add here appears in every department dropdown. Student
        numbers are counted through the sections each department's teachers
        handle.
      </PageHeader>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          {departments.length === 0 ? (
            <Empty>
              No departments yet. Add one before creating teacher accounts.
            </Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Short name</Th>
                    <Th>Department</Th>
                    <Th>Faculty</Th>
                    <Th>Students</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="border-b border-[#F0F3F5]">
                      <Td>
                        <span className="font-mono">{d.code}</span>
                      </Td>
                      <Td>
                        <RenameCell id={d.id} name={d.name} code={d.code} />
                      </Td>
                      <Td>
                        <span className="font-mono">{d.faculty_count}</span>
                      </Td>
                      <Td>
                        <span className="font-mono">{d.student_count}</span>
                      </Td>
                      <Td>
                        {Number(d.faculty_count) === 0 &&
                        Number(d.student_count) === 0 ? (
                          <ConfirmDelete
                            action={deleteDepartment}
                            hidden={{ id: d.id, name: d.name }}
                            question={`Delete ${d.name}?`}
                            note="It disappears from every department dropdown."
                          />
                        ) : (
                          <span className="text-xs text-[#B4BFC8]">In use</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card>
          <DeptForm />
        </Card>
      </div>
    </>
  );
}

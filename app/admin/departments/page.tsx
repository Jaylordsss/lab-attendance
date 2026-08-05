import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { deleteDepartment } from "./actions";
import DeptForm from "./form";
import RenameCell from "./rename-cell";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; staff_count: number };

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("department_summary");

  if (error) console.error("department_summary:", error.message);

  const departments = (data ?? []) as Row[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Departments">
        Whatever you add here appears in every department dropdown. A
        department with staff in it can't be deleted — move them first.
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
                    <Th>Department</Th>
                    <Th>Staff</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="border-b border-[#F0F3F5]">
                      <Td>
                        <RenameCell id={d.id} name={d.name} />
                      </Td>
                      <Td>
                        <span className="font-mono">{d.staff_count}</span>
                      </Td>
                      <Td>
                        {Number(d.staff_count) === 0 ? (
                          <form action={deleteDepartment}>
                            <input type="hidden" name="id" value={d.id} />
                            <input type="hidden" name="name" value={d.name} />
                            <button
                              type="submit"
                              className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
                            >
                              Delete
                            </button>
                          </form>
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

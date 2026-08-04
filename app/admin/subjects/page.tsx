import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import SubjectForm from "./form";

export const dynamic = "force-dynamic";

type Subject = { id: string; code: string; title: string };

export default async function SubjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("id, code, title")
    .order("code");

  const subjects = (data ?? []) as Subject[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Subjects">
        A subject is what is taught. A section is one class of students taking
        it, at a fixed time in a fixed laboratory.
      </PageHeader>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          {subjects.length === 0 ? (
            <Empty>No subjects yet. Add one before creating sections.</Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Code</Th>
                    <Th>Title</Th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id} className="border-b border-[#F0F3F5]">
                      <Td><span className="font-mono">{s.code}</span></Td>
                      <Td>{s.title}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card>
          <SubjectForm />
        </Card>
      </div>
    </>
  );
}

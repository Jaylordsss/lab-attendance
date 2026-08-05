import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { deleteSubject } from "./actions";
import SubjectForm from "./form";
import EditSubjectCell from "./edit-cell";

export const dynamic = "force-dynamic";

type Subject = { id: string; code: string; title: string };

export default async function SubjectsPage() {
  const supabase = await createClient();

  const [subjectsRes, sectionsRes] = await Promise.all([
    supabase.from("subjects").select("id, code, title").order("code"),
    supabase.from("sections").select("subject_id"),
  ]);

  const subjects = (subjectsRes.data ?? []) as Subject[];

  // How many sections each subject carries, so the page can say why one
  // cannot be deleted rather than just refusing.
  const inUse = new Map<string, number>();
  for (const s of (sectionsRes.data ?? []) as { subject_id: string }[]) {
    inUse.set(s.subject_id, (inUse.get(s.subject_id) ?? 0) + 1);
  }

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
                    <Th>Sections</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => {
                    const used = inUse.get(s.id) ?? 0;
                    return (
                      <tr key={s.id} className="border-b border-[#F0F3F5]">
                        <Td>
                          <span className="font-mono">{s.code}</span>
                        </Td>
                        <Td>
                          <EditSubjectCell
                            id={s.id}
                            code={s.code}
                            title={s.title}
                          />
                        </Td>
                        <Td>
                          <span className="font-mono">{used}</span>
                        </Td>
                        <Td>
                          {used === 0 ? (
                            <form action={deleteSubject}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="code" value={s.code} />
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
                    );
                  })}
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

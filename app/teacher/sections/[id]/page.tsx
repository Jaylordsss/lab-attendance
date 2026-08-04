import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { DAY_NAMES } from "@/app/admin/sections/days";
import EnrolForm from "./form";
import SessionPanel from "./session-panel";
import { removeStudent } from "./actions";

export const dynamic = "force-dynamic";

type RosterRow = {
  user_id: string;
  student_no: string;
  full_name: string;
  birthdate: string;
};

function manilaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("sections")
    .select("id, name, day_of_week, start_time, end_time, teacher_id, grace_minutes, subjects(code, title), rooms(code, name)")
    .eq("id", id)
    .maybeSingle();

  if (!section || (section as any).teacher_id !== teacher.id) notFound();

  const { data: rosterData } = await supabase.rpc("section_roster", {
    p_section_id: id,
  });
  const roster = (rosterData ?? []) as RosterRow[];

  // Today's session, if any.
  const service = getServiceClient();
  const { data: session } = await service
    .from("class_sessions")
    .select("id, status")
    .eq("section_id", id)
    .eq("session_date", manilaToday())
    .maybeSingle();

  let attendees: any[] = [];
  if (session) {
    const { data } = await service
      .from("attendance")
      .select("status, scanned_at, students(student_no), profiles:student_id(full_name)")
      .eq("class_session_id", session.id)
      .order("scanned_at", { ascending: false });

    attendees = (data ?? []).map((a: any) => ({
      status: a.status,
      scanned_at: a.scanned_at,
      student_no: a.students?.student_no ?? "",
      full_name: a.profiles?.full_name ?? "",
    }));
  }

  const s = section as any;

  return (
    <>
      <PageHeader
        eyebrow={`${s.subjects?.code} · ${DAY_NAMES[s.day_of_week]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`}
        title={s.name}
      >
        {s.subjects?.title} in {s.rooms?.name ?? "no laboratory assigned"}.
        Scans after {s.grace_minutes} minutes are marked late.
      </PageHeader>

      <div className="mb-8">
        <SessionPanel
          sectionId={id}
          sessionId={(session?.id as string) ?? null}
          isOpen={session?.status === "open"}
          roomCode={s.rooms?.code ?? null}
          attendees={attendees}
          enrolledCount={roster.length}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-medium">Roster</h2>
            <span className="text-xs text-[#5A6B7A]">
              {roster.length} {roster.length === 1 ? "student" : "students"}
            </span>
          </div>

          {roster.length === 0 ? (
            <Empty>Nobody enrolled yet. Add your first student.</Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Student number</Th>
                    <Th>Name</Th>
                    <Th>Birthday</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((student) => (
                    <tr key={student.user_id} className="border-b border-[#F0F3F5]">
                      <Td><span className="font-mono">{student.student_no}</span></Td>
                      <Td>{student.full_name}</Td>
                      <Td>
                        <span className="text-[#5A6B7A]">
                          {new Date(student.birthdate).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </Td>
                      <Td>
                        <form action={removeStudent}>
                          <input type="hidden" name="sectionId" value={id} />
                          <input type="hidden" name="studentId" value={student.user_id} />
                          <button
                            type="submit"
                            className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
                          >
                            Remove
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card>
          <EnrolForm sectionId={id} />
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin-ui";
import DataTable from "@/components/data-table";
import SectionForm from "./form";
import { DAY_NAMES } from "./days";

export const dynamic = "force-dynamic";

export default async function SectionsPage() {
  const supabase = await createClient();

  const [sectionsRes, subjectsRes, roomsRes, staffRes] = await Promise.all([
    supabase
      .from("sections")
      .select(
        "id, name, day_of_week, start_time, end_time, grace_minutes, subjects(code), rooms(code)",
      )
      .order("day_of_week")
      .order("start_time"),
    supabase.from("subjects").select("id, code, title").order("code"),
    supabase.from("rooms").select("id, code, name").order("code"),
    supabase.rpc("staff_directory"),
  ]);

  const sections = (sectionsRes.data ?? []) as any[];
  const subjects = (subjectsRes.data ?? []) as {
    id: string;
    code: string;
    title: string;
  }[];
  const rooms = (roomsRes.data ?? []) as {
    id: string;
    code: string;
    name: string;
  }[];
  const teachers = ((staffRes.data ?? []) as any[]).filter(
    (s) => s.role === "teacher",
  );

  const ready = subjects.length > 0 && rooms.length > 0 && teachers.length > 0;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Sections">
        A section binds a subject, a teacher, a laboratory and a weekly time
        slot. Students are enrolled into sections.
      </PageHeader>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          <DataTable
            empty="No sections yet."
            columns={[
              { head: "Section" },
              { head: "Subject" },
              { head: "Laboratory" },
              { head: "When" },
            ]}
            rows={sections.map((s) => ({
              key: s.id,
              cells: [
                <Link
                  key="name"
                  href={`/admin/sections/${s.id}`}
                  className="underline underline-offset-4 hover:text-[#0B6E5F]"
                >
                  {s.name}
                </Link>,
                <span key="subj" className="font-mono">
                  {s.subjects?.code}
                </span>,
                <span key="room" className="font-mono">
                  {s.rooms?.code ?? "—"}
                </span>,
                <span key="when">
                  {DAY_NAMES[s.day_of_week]}{" "}
                  <span className="font-mono text-xs text-[#5A6B7A]">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                </span>,
              ],
            }))}
          />
        </section>

        <Card>
          {ready ? (
            <SectionForm subjects={subjects} rooms={rooms} teachers={teachers} />
          ) : (
            <div className="text-sm text-[#5A6B7A] leading-relaxed space-y-2">
              <h2 className="text-sm font-medium text-[#16202B]">
                Add these first
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                {subjects.length === 0 && <li>At least one subject</li>}
                {rooms.length === 0 && <li>At least one laboratory</li>}
                {teachers.length === 0 && <li>At least one teacher</li>}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

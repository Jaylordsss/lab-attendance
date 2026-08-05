import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { DAY_NAMES } from "../days";
import EditSectionForm, { type SectionValues } from "./edit-form";

export const dynamic = "force-dynamic";

type RosterRow = {
  user_id: string;
  student_no: string;
  full_name: string;
  birthdate: string;
};

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [sectionRes, rosterRes, subjectsRes, roomsRes, staffRes] =
    await Promise.all([
      supabase
        .from("sections")
        .select(
          "id, name, subject_id, teacher_id, default_room_id, day_of_week, start_time, end_time, grace_minutes, subjects(code, title), rooms(code, name), profiles(full_name)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.rpc("section_roster", { p_section_id: id }),
      supabase.from("subjects").select("id, code, title").order("code"),
      supabase.from("rooms").select("id, code, name").order("code"),
      supabase.rpc("staff_directory"),
    ]);

  if (!sectionRes.data) notFound();

  const s = sectionRes.data as any;
  const roster = (rosterRes.data ?? []) as RosterRow[];
  const teachers = ((staffRes.data ?? []) as any[]).filter(
    (p) => p.role === "teacher",
  );

  return (
    <>
      <Link
        href="/admin/sections"
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        All sections
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow={`${s.subjects?.code} · ${DAY_NAMES[s.day_of_week]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`}
          title={s.name}
        >
          {s.subjects?.title} · {s.rooms?.name ?? "no laboratory"} · taught by{" "}
          {s.profiles?.full_name} · {s.grace_minutes} minute grace period
        </PageHeader>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          <h2 className="text-sm font-medium mb-3">Roster</h2>
          {roster.length === 0 ? (
            <Empty>Nobody is enrolled in this section yet.</Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Student number</Th>
                    <Th>Name</Th>
                    <Th>Birthday</Th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((student) => (
                    <tr key={student.user_id} className="border-b border-[#F0F3F5]">
                      <Td>
                        <span className="font-mono">{student.student_no}</span>
                      </Td>
                      <Td>{student.full_name}</Td>
                      <Td>
                        <span className="text-[#5A6B7A]">
                          {new Date(student.birthdate).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs text-[#5A6B7A]">
                {roster.length} enrolled
              </p>
            </div>
          )}
        </section>

        <Card>
          <EditSectionForm
            section={s as SectionValues}
            subjects={(subjectsRes.data ?? []) as any[]}
            rooms={(roomsRes.data ?? []) as any[]}
            teachers={teachers}
          />
        </Card>
      </div>
    </>
  );
}

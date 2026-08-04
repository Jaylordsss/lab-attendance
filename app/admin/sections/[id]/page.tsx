import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Empty, Th, Td } from "@/components/admin-ui";
import { DAY_NAMES } from "../days";

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

  const { data: section } = await supabase
    .from("sections")
    .select("id, name, day_of_week, start_time, end_time, grace_minutes, subjects(code, title), rooms(code, name), profiles(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!section) notFound();

  const { data } = await supabase.rpc("section_roster", { p_section_id: id });
  const roster = (data ?? []) as RosterRow[];
  const s = section as any;

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
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-[#5A6B7A]">
            {roster.length} enrolled
          </p>
        </div>
      )}
    </>
  );
}

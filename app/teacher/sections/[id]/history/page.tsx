import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";
import { PageHeader, Empty, Th, Td } from "@/components/admin-ui";
import PdfPreview from "@/components/pdf-preview";

export const dynamic = "force-dynamic";

type Session = {
  id: string;
  session_date: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  present: number;
  late: number;
  absent: number;
  refused: number;
};

export default async function SectionHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("sections")
    .select("id, name, teacher_id, subjects(code, title)")
    .eq("id", id)
    .maybeSingle();

  if (!section || (section as any).teacher_id !== teacher.id) notFound();

  const { data, error } = await getServiceClient().rpc("section_sessions", {
    p_section_id: id,
    p_limit: 60,
  });

  if (error) console.error("section_sessions:", error.message);

  const sessions = (data ?? []) as Session[];
  const s = section as any;

  const totals = sessions.reduce(
    (acc, x) => ({
      present: acc.present + Number(x.present),
      late: acc.late + Number(x.late),
      absent: acc.absent + Number(x.absent),
    }),
    { present: 0, late: 0, absent: 0 },
  );

  const marked = totals.present + totals.late + totals.absent;
  const rate = marked
    ? Math.round(((totals.present + totals.late) / marked) * 100)
    : null;

  return (
    <>
      <Link
        href={`/teacher/sections/${id}`}
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        Back to {s.name}
      </Link>

      <div className="mt-4">
        <PageHeader eyebrow={s.subjects?.code} title="Past classes">
          Every session this section has held. Open any one to download its
          record.
        </PageHeader>
      </div>

      {sessions.length === 0 ? (
        <Empty>This section hasn&rsquo;t held a class yet.</Empty>
      ) : (
        <>
          <div className="mb-6 flex gap-8 flex-wrap">
            <Stat label="Classes held" value={sessions.length} />
            <Stat label="Present" value={totals.present} colour="#0B6E5F" />
            <Stat label="Late" value={totals.late} colour="#A8321F" />
            <Stat label="Absent" value={totals.absent} colour="#5A6B7A" />
            {rate !== null && (
              <Stat
                label="Turnout"
                value={`${rate}%`}
                colour={rate < 80 ? "#A8321F" : "#0B6E5F"}
              />
            )}
          </div>

          <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8ED]">
                  <Th>Date</Th>
                  <Th>Held</Th>
                  <Th>Present</Th>
                  <Th>Late</Th>
                  <Th>Absent</Th>
                  <Th>Refused</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-[#F0F3F5]">
                    <Td>
                      <span className="block">
                        {new Date(session.session_date).toLocaleDateString(
                          "en-PH",
                          { weekday: "short", day: "numeric", month: "short" },
                        )}
                      </span>
                      <span className="block font-mono text-xs text-[#5A6B7A]">
                        {session.session_date}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-[#5A6B7A]">
                        {timeOf(session.opened_at)}
                        {session.closed_at && `–${timeOf(session.closed_at)}`}
                      </span>
                      {session.status === "open" && (
                        <span
                          className="block text-xs"
                          style={{ color: "#0B6E5F" }}
                        >
                          Still open
                        </span>
                      )}
                    </Td>
                    <Td><span className="font-mono">{session.present}</span></Td>
                    <Td>
                      <span
                        className="font-mono"
                        style={{ color: Number(session.late) ? "#A8321F" : undefined }}
                      >
                        {session.late}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[#5A6B7A]">
                        {session.absent}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="font-mono"
                        style={{ color: Number(session.refused) ? "#A8321F" : "#B4BFC8" }}
                      >
                        {session.refused}
                      </span>
                    </Td>
                    <Td>
                      <PdfPreview
                        href={`/api/sessions/${session.id}/report`}
                        label="View"
                        title={`Attendance — ${session.session_date}`}
                        className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  colour,
}: {
  label: string;
  value: number | string;
  colour?: string;
}) {
  return (
    <div>
      <p className="font-mono text-2xl leading-none" style={{ color: colour }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
        {label}
      </p>
    </div>
  );
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
  });
}

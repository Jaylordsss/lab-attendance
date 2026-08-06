import { createClient } from "@/lib/supabase/server";
import { PageHeader, Empty, Th, Td } from "@/components/admin-ui";
import { rpcArgs, toQuery, DAY_NAMES, type LogFilters } from "@/lib/report-filters";
import Filters from "./filters";
import PdfPreview from "@/components/pdf-preview";

export const dynamic = "force-dynamic";

type LogRow = {
  session_date: string;
  student_no: string;
  full_name: string;
  status: string;
  scanned_at: string | null;
  section_name: string;
  subject_code: string;
  room_code: string;
  teacher_name: string;
  start_time: string;
  day_of_week: number;
};

const STATUS_COLOR: Record<string, string> = {
  present: "#0B6E5F",
  late: "#A8321F",
  absent: "#5A6B7A",
  excused: "#5A6B7A",
};

export default async function AttendanceLogPage({
  searchParams,
}: {
  searchParams: Promise<LogFilters>;
}) {
  const filters = await searchParams;
  const supabase = await createClient();

  const [logRes, optionsRes] = await Promise.all([
    supabase.rpc("attendance_log", rpcArgs(filters)),
    supabase.rpc("filter_options"),
  ]);

  if (logRes.error) console.error("attendance_log:", logRes.error.message);

  const rows = (logRes.data ?? []) as LogRow[];
  const options = (optionsRes.data ?? {
    rooms: [], subjects: [], teachers: [], sections: [],
  }) as any;

  const counts = {
    present: rows.filter((r) => r.status === "present").length,
    late: rows.filter((r) => r.status === "late").length,
    absent: rows.filter((r) => r.status === "absent").length,
  };

  const query = toQuery(filters);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Attendance log">
        Every scan across every laboratory. Narrow it down, then export the
        same view as a PDF.
      </PageHeader>

      <Filters options={options} current={filters} />

      <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-8">
          {(["present", "late", "absent"] as const).map((k) => (
            <div key={k}>
              <p
                className="font-mono text-2xl leading-none"
                style={{ color: STATUS_COLOR[k] }}
              >
                {counts[k]}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                {k}
              </p>
            </div>
          ))}
        </div>

        <PdfPreview
          href={`/api/reports/attendance?${query}`}
          label="View PDF"
          title="Attendance log"
          className="bg-[#16202B] text-white rounded py-2.5 px-5 text-sm hover:bg-[#0B6E5F] transition-colors"
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <Empty>No attendance matches those filters.</Empty>
        </div>
      ) : (
        <div className="mt-6 bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8ED]">
                <Th>Date</Th>
                <Th>Student</Th>
                <Th>Section</Th>
                <Th>Laboratory</Th>
                <Th>Status</Th>
                <Th>Time in</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#F0F3F5]">
                  <Td>
                    <span className="font-mono text-xs">{r.session_date}</span>
                    <span className="block text-xs text-[#5A6B7A]">
                      {DAY_NAMES[r.day_of_week]}
                    </span>
                  </Td>
                  <Td>
                    <span className="block">{r.full_name}</span>
                    <span className="block font-mono text-xs text-[#5A6B7A]">
                      {r.student_no}
                    </span>
                  </Td>
                  <Td>
                    <span className="block">{r.section_name}</span>
                    <span className="block text-xs text-[#5A6B7A]">
                      {r.subject_code} · {r.teacher_name}
                    </span>
                  </Td>
                  <Td><span className="font-mono">{r.room_code}</span></Td>
                  <Td>
                    <span style={{ color: STATUS_COLOR[r.status] }}>
                      {r.status}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">
                      {r.scanned_at
                        ? new Date(r.scanned_at).toLocaleTimeString("en-PH", {
                            timeZone: "Asia/Manila",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-[#5A6B7A]">{rows.length} records</p>
        </div>
      )}
    </>
  );
}

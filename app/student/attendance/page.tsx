import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { Empty, Th, Td } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

type Summary = {
  section_name: string;
  subject_code: string;
  present: number;
  late: number;
  absent: number;
  rate: number | null;
};

type AttendanceRow = {
  session_date: string;
  subject_code: string;
  section_name: string;
  room_code: string;
  status: string;
  scanned_at: string | null;
};

const COLOUR: Record<string, string> = {
  present: "#0B6E5F",
  late: "#A8321F",
  absent: "#5A6B7A",
  excused: "#5A6B7A",
};

export default async function StudentAttendancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [summaryRes, recentRes] = await Promise.all([
    supabase.rpc("student_attendance_summary", { p_user_id: user.id }),
    supabase.rpc("my_attendance", { p_user_id: user.id, p_limit: 40 }),
  ]);

  if (summaryRes.error) console.error("summary:", summaryRes.error.message);
  if (recentRes.error) console.error("attendance:", recentRes.error.message);

  const summary = (summaryRes.data ?? []) as Summary[];
  const recent = (recentRes.data ?? []) as AttendanceRow[];

  return (
    <>
      <Link
        href="/student"
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        Back to the scanner
      </Link>

      <h1 className="mt-4 mb-1 text-2xl font-medium">Your attendance</h1>
      <p className="mb-6 text-sm text-[#5A6B7A] leading-relaxed">
        Present and late both count as attended. Below eighty per cent is worth
        speaking to your teacher about.
      </p>

      {summary.length === 0 ? (
        <Empty>Nothing recorded yet. It appears here after your first scan.</Empty>
      ) : (
        <>
          <ul className="space-y-3">
            {summary.map((s, i) => {
              const rate = s.rate ?? 0;
              const low = rate < 80;
              return (
                <li
                  key={i}
                  className="rounded-lg border bg-white p-5"
                  style={{ borderColor: low ? "#E8C4BC" : "#D8DFE5" }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="font-medium">{s.subject_code}</p>
                      <p className="text-sm text-[#5A6B7A]">{s.section_name}</p>
                    </div>
                    <p
                      className="font-mono text-2xl leading-none shrink-0"
                      style={{ color: low ? "#A8321F" : "#0B6E5F" }}
                    >
                      {rate}%
                    </p>
                  </div>

                  {/* A bar reads faster than three numbers when the point is
                      simply whether the figure is comfortable or not. */}
                  <div className="mt-3 h-1.5 rounded-full bg-[#E2E8ED] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(rate, 100)}%`,
                        backgroundColor: low ? "#A8321F" : "#0B6E5F",
                      }}
                    />
                  </div>

                  <p className="mt-3 text-sm text-[#5A6B7A]">
                    {s.present} present · {s.late} late · {s.absent} absent
                  </p>
                </li>
              );
            })}
          </ul>

          {recent.length > 0 && (
            <section className="mt-10">
              <h2 className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-3">
                Recent classes
              </h2>
              <div className="bg-white border border-[#D8DFE5] rounded-lg p-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8ED]">
                      <Th>Date</Th>
                      <Th>Class</Th>
                      <Th>Status</Th>
                      <Th>Time in</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, i) => (
                      <tr key={i} className="border-b border-[#F0F3F5]">
                        <Td>
                          <span className="font-mono text-xs">
                            {r.session_date}
                          </span>
                        </Td>
                        <Td>
                          <span className="block">{r.subject_code}</span>
                          <span className="block font-mono text-xs text-[#5A6B7A]">
                            {r.room_code}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ color: COLOUR[r.status] }}>
                            {r.status}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-mono text-xs">
                            {r.scanned_at
                              ? new Date(r.scanned_at).toLocaleTimeString(
                                  "en-PH",
                                  {
                                    timeZone: "Asia/Manila",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—"}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

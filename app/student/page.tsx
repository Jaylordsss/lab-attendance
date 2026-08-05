import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { DAY_NAMES } from "@/lib/report-filters";
import Scanner from "./scanner";

export const dynamic = "force-dynamic";

type ClassRow = {
  section_id: string;
  section_name: string;
  subject_code: string;
  subject_title: string;
  room_code: string | null;
  room_name: string | null;
  teacher_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  grace_minutes: number;
};

type OpenClass = {
  section_name: string;
  subject_code: string;
  room_code: string;
  room_name: string;
  teacher_name: string;
};

const hhmm = (t: string) => t.slice(0, 5);

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [scheduleRes, openRes] = await Promise.all([
    supabase.rpc("my_schedule", { p_user_id: user.id }),
    supabase.rpc("my_open_class", { p_user_id: user.id }),
  ]);

  if (scheduleRes.error) console.error("my_schedule:", scheduleRes.error.message);

  const schedule = (scheduleRes.data ?? []) as ClassRow[];
  const openClass = ((openRes.data ?? []) as OpenClass[])[0] ?? null;

  const firstName = user.fullName.split(" ")[0];

  // Manila weekday, so "today" matches the school's clock rather than the
  // browser's timezone.
  const todayIndex = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  ).getDay();

  const today = schedule.filter((c) => c.day_of_week === todayIndex);
  const rest = schedule.filter((c) => c.day_of_week !== todayIndex);

  return (
    <>
      <h1 className="text-2xl font-medium mb-1">Scan to check in</h1>
      <p className="text-sm text-[#5A6B7A] mb-6 leading-relaxed">
        Your location and camera are both needed — they prove you're in the
        laboratory.
      </p>

      {openClass && (
        <div className="mb-6 rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#0B6E5F]">
            Open now
          </p>
          <p className="mt-1 font-medium">
            {openClass.subject_code} — {openClass.section_name}
          </p>
          <p className="text-sm text-[#5A6B7A]">
            {openClass.room_code} {openClass.room_name} · {openClass.teacher_name}
          </p>
        </div>
      )}

      <Scanner firstName={firstName} presetToken={t} />

      {today.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-3">
            Today · {DAY_NAMES[todayIndex]}
          </h2>
          <ul className="space-y-3">
            {today.map((c) => (
              <ClassCard key={c.section_id} c={c} highlight />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-3">
            {today.length > 0 ? "Other days" : "Your classes"}
          </h2>
          <ul className="space-y-3">
            {rest.map((c) => (
              <ClassCard key={c.section_id} c={c} />
            ))}
          </ul>
        </section>
      )}

      {schedule.length === 0 && (
        <p className="mt-10 text-sm text-[#5A6B7A] border border-dashed border-[#D8DFE5] rounded-lg p-6">
          You're not enrolled in any classes yet. Ask your teacher.
        </p>
      )}
    </>
  );
}

function ClassCard({ c, highlight }: { c: ClassRow; highlight?: boolean }) {
  return (
    <li
      className="rounded-lg border bg-white p-4"
      style={{ borderColor: highlight ? "#B7CFC9" : "#D8DFE5" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {c.subject_code} — {c.section_name}
        </p>
        <p className="font-mono text-xs text-[#5A6B7A] shrink-0">
          {hhmm(c.start_time)}–{hhmm(c.end_time)}
        </p>
      </div>

      <p className="mt-1 text-sm text-[#5A6B7A]">{c.subject_title}</p>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-[#5A6B7A]">Day</dt>
        <dd>{DAY_NAMES[c.day_of_week]}</dd>

        <dt className="text-[#5A6B7A]">Laboratory</dt>
        <dd>
          {c.room_code ? (
            <>
              <span className="font-mono">{c.room_code}</span>
              {c.room_name && ` — ${c.room_name}`}
            </>
          ) : (
            <span className="text-[#B4BFC8]">Not assigned</span>
          )}
        </dd>

        <dt className="text-[#5A6B7A]">Teacher</dt>
        <dd>{c.teacher_name}</dd>
      </dl>

      <p className="mt-3 text-xs text-[#5A6B7A]">
        Scanning after {hhmm(c.start_time)} plus {c.grace_minutes} minutes is
        marked late.
      </p>
    </li>
  );
}

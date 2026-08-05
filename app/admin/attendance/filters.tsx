"use client";

import { useRouter } from "next/navigation";
import { fieldClass, labelClass } from "@/components/admin-ui";
import { rangeFor, toQuery, DAY_NAMES, type LogFilters } from "@/lib/report-filters";

export default function Filters({
  options,
  current,
}: {
  options: {
    rooms: { id: string; code: string; name: string }[];
    subjects: { id: string; code: string; title: string }[];
    teachers: { id: string; name: string }[];
    sections: { id: string; name: string }[];
  };
  current: LogFilters;
}) {
  const router = useRouter();

  function set(patch: Partial<LogFilters>) {
    router.push(`/admin/attendance?${toQuery({ ...current, ...patch })}`);
  }

  function preset(p: "day" | "week" | "month") {
    set(rangeFor(p));
  }

  const select = `${fieldClass} appearance-none`;

  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-5 space-y-5">
      <div className="flex gap-2 flex-wrap">
        {(["day", "week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => preset(p)}
            className="border border-[#D8DFE5] rounded py-1.5 px-4 text-sm hover:border-[#0B6E5F] hover:text-[#0B6E5F] transition-colors"
          >
            {p === "day" ? "Today" : p === "week" ? "Last 7 days" : "Last 30 days"}
          </button>
        ))}
        {Object.values(current).some(Boolean) && (
          <button
            onClick={() => router.push("/admin/attendance")}
            className="text-sm underline underline-offset-4 text-[#5A6B7A] hover:text-[#A8321F] ml-auto"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="from" className={labelClass}>From</label>
          <input
            id="from"
            type="date"
            value={current.from ?? ""}
            onChange={(e) => set({ from: e.target.value })}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div>
          <label htmlFor="to" className={labelClass}>To</label>
          <input
            id="to"
            type="date"
            value={current.to ?? ""}
            onChange={(e) => set({ to: e.target.value })}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div>
          <label htmlFor="day" className={labelClass}>Day of week</label>
          <select
            id="day"
            value={current.day ?? ""}
            onChange={(e) => set({ day: e.target.value })}
            className={select}
          >
            <option value="">Any day</option>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="status" className={labelClass}>Status</label>
          <select
            id="status"
            value={current.status ?? ""}
            onChange={(e) => set({ status: e.target.value })}
            className={select}
          >
            <option value="">Any status</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>
        </div>

        <div>
          <label htmlFor="room" className={labelClass}>Laboratory</label>
          <select
            id="room"
            value={current.room ?? ""}
            onChange={(e) => set({ room: e.target.value })}
            className={select}
          >
            <option value="">All laboratories</option>
            {options.rooms.map((r) => (
              <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className={labelClass}>Subject</label>
          <select
            id="subject"
            value={current.subject ?? ""}
            onChange={(e) => set({ subject: e.target.value })}
            className={select}
          >
            <option value="">All subjects</option>
            {options.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.code}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="teacher" className={labelClass}>Teacher</label>
          <select
            id="teacher"
            value={current.teacher ?? ""}
            onChange={(e) => set({ teacher: e.target.value })}
            className={select}
          >
            <option value="">All teachers</option>
            {options.teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="section" className={labelClass}>Section</label>
          <select
            id="section"
            value={current.section ?? ""}
            onChange={(e) => set({ section: e.target.value })}
            className={select}
          >
            <option value="">All sections</option>
            {options.sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * Filter values shared by the admin attendance log and its PDF export, so the
 * download always matches exactly what is on screen.
 */

export type LogFilters = {
  from?: string;
  to?: string;
  room?: string;
  subject?: string;
  teacher?: string;
  section?: string;
  day?: string;
  status?: string;
};

/** Presets for the daily, weekly and monthly exports. */
export function rangeFor(preset: "day" | "week" | "month"): {
  from: string;
  to: string;
} {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  );
  const to = iso(now);

  if (preset === "day") return { from: to, to };

  const start = new Date(now);
  if (preset === "week") start.setDate(now.getDate() - 6);
  else start.setDate(now.getDate() - 29);

  return { from: iso(start), to };
}

export function iso(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function toQuery(f: LogFilters): string {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  return p.toString();
}

export function rpcArgs(f: LogFilters) {
  return {
    p_from: f.from || null,
    p_to: f.to || null,
    p_room_id: f.room || null,
    p_subject_id: f.subject || null,
    p_teacher_id: f.teacher || null,
    p_section_id: f.section || null,
    p_day: f.day ? Number(f.day) : null,
    p_status: f.status || null,
  };
}

export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const;

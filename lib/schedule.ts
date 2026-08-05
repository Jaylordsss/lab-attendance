/**
 * When a class may be opened.
 *
 * Attendance is only meaningful if it happens at the scheduled time. Without
 * this a teacher could open Monday's session on Thursday evening, and the
 * record would look identical to a real one.
 *
 * Used in two places: the server action, which enforces it, and the panel,
 * which explains it. Same function, so the button and the rule can never
 * disagree.
 */

/** Teachers often set up a few minutes early. */
export const EARLY_START_MINUTES = 15;

/**
 * A class stays openable until its end time — a late start is legitimate
 * (equipment trouble, a delayed period), and refusing it would just push the
 * teacher to a paper list.
 */
export const LATE_START_GRACE_MINUTES = 0;

export type Schedule = {
  day_of_week: number;
  start_time: string; // HH:MM:SS
  end_time: string;
};

export type StartWindow = {
  canStart: boolean;
  reason: "ok" | "wrong_day" | "too_early" | "too_late";
  opensAt: string;  // HH:MM
  closesAt: string; // HH:MM
};

/** Minutes since midnight, Manila. */
function nowInManila(): { day: number; minutes: number } {
  const manila = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
  );
  return {
    day: manila.getDay(),
    minutes: manila.getHours() * 60 + manila.getMinutes(),
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function startWindow(section: Schedule): StartWindow {
  const { day, minutes } = nowInManila();

  const opens = toMinutes(section.start_time) - EARLY_START_MINUTES;
  const closes = toMinutes(section.end_time) + LATE_START_GRACE_MINUTES;

  const window = { opensAt: toHHMM(opens), closesAt: toHHMM(closes) };

  if (day !== section.day_of_week) {
    return { canStart: false, reason: "wrong_day", ...window };
  }
  if (minutes < opens) {
    return { canStart: false, reason: "too_early", ...window };
  }
  if (minutes > closes) {
    return { canStart: false, reason: "too_late", ...window };
  }

  return { canStart: true, reason: "ok", ...window };
}

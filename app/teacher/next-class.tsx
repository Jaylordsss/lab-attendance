"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type NextClass = {
  section_id: string;
  section_name: string;
  subject_code: string;
  subject_title: string;
  room_code: string | null;
  room_name: string | null;
  start_time: string;
  end_time: string;
  minutes_until: number;
  session_open: boolean;
  enrolled_count: number;
};

/** Minutes before the start at which the reminder fires. */
const REMIND_AT = 30;

const hhmm = (t: string) => t.slice(0, 5);

export default function NextClassBanner({ next }: { next: NextClass }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(next.minutes_until);
  const notified = useRef<string | null>(null);

  // Count down locally and re-fetch every minute, so the banner stays honest
  // without the teacher reloading.
  useEffect(() => {
    setMinutes(next.minutes_until);
    const timer = setInterval(() => {
      setMinutes((m) => m - 1);
      router.refresh();
    }, 60_000);
    return () => clearInterval(timer);
  }, [next.minutes_until, next.section_id, router]);

  // One notification per class, at the threshold. Fires only if the teacher
  // has granted permission; we never ask unprompted, since a permission
  // dialog on arrival is the fastest way to get it denied for good.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (next.session_open) return;
    if (minutes > REMIND_AT || minutes < -60) return;
    if (notified.current === next.section_id) return;

    notified.current = next.section_id;

    new Notification(
      minutes < 0
        ? `${next.section_name} has started`
        : `${next.section_name} starts in ${minutes} minutes`,
      {
        body: `${next.subject_code} · ${next.room_code ?? "no laboratory"} · ${hhmm(next.start_time)}`,
        tag: `class-${next.section_id}`,
        icon: "/icon-192.png",
      },
    );
  }, [minutes, next]);

  const started = minutes <= 0;
  const soon = minutes <= REMIND_AT;

  // Running with no session open is the case worth shouting about: the class
  // is happening and nothing is being recorded.
  const urgent = started && !next.session_open;

  const tone = next.session_open
    ? { border: "#0B6E5F", bg: "#F2F8F6", text: "#0B6E5F" }
    : urgent
      ? { border: "#A8321F", bg: "#FDF4F2", text: "#A8321F" }
      : soon
        ? { border: "#16202B", bg: "#FFFFFF", text: "#16202B" }
        : { border: "#D8DFE5", bg: "#FFFFFF", text: "#5A6B7A" };

  const headline = next.session_open
    ? "Attendance is open"
    : urgent
      ? `Started ${Math.abs(minutes)} ${Math.abs(minutes) === 1 ? "minute" : "minutes"} ago — not opened`
      : started
        ? "Starting now"
        : minutes <= REMIND_AT
          ? `Starts in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`
          : `Later today at ${hhmm(next.start_time)}`;

  return (
    <div
      className="mb-8 rounded-lg border-2 p-5"
      style={{ borderColor: tone.border, backgroundColor: tone.bg }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: tone.text }}
          >
            {headline}
          </p>
          <p className="mt-1 text-lg font-medium">
            {next.subject_code} — {next.section_name}
          </p>
          <p className="mt-1 text-sm text-[#5A6B7A]">
            {hhmm(next.start_time)}–{hhmm(next.end_time)} ·{" "}
            {next.room_code ? (
              <>
                <span className="font-mono">{next.room_code}</span>
                {next.room_name && ` ${next.room_name}`}
              </>
            ) : (
              "no laboratory assigned"
            )}{" "}
            · {next.enrolled_count}{" "}
            {Number(next.enrolled_count) === 1 ? "student" : "students"}
          </p>
        </div>

        <Link
          href={`/teacher/sections/${next.section_id}`}
          className="rounded py-2.5 px-5 text-sm tracking-wide text-white transition-colors shrink-0"
          style={{ backgroundColor: urgent ? "#A8321F" : "#16202B" }}
        >
          {next.session_open ? "Open class" : "Go to class"}
        </Link>
      </div>

      <NotificationOptIn />
    </div>
  );
}

/**
 * Asks for notification permission only when the teacher taps, never on load.
 * A dialog that appears unbidden is the fastest way to get denied permanently,
 * and denial is not reversible from the page.
 */
function NotificationOptIn() {
  const [state, setState] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  useEffect(() => {
    if (typeof Notification === "undefined") setState("unsupported");
    else setState(Notification.permission);
  }, []);

  if (state !== "default") return null;

  return (
    <button
      onClick={async () => setState(await Notification.requestPermission())}
      className="mt-4 text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
    >
      Remind me 30 minutes before each class
    </button>
  );
}

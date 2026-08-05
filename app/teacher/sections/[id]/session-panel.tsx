"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startSession, endSession } from "./session-actions";
import QrDisplay from "./qr-display";

type Attendee = {
  full_name: string;
  student_no: string;
  status: string;
  scanned_at: string;
};

type Rejection = {
  full_name: string;
  student_no: string;
  reason: string;
  at: string;
  distance_m: number | null;
};

const REASON_LABEL: Record<string, string> = {
  not_enrolled: "Not enrolled in this class",
  out_of_range: "Outside the laboratory",
  already_marked: "Already marked in",
  device_mismatch: "Scanned from a different phone",
  no_open_session: "No class was open",
  invalid_code: "Unrecognised code",
  device_not_bound: "Phone not registered",
  unauthenticated: "Not signed in",
  server_error: "Something went wrong",
};

/** Reasons a teacher should look at, rather than shrug off. */
const SUSPICIOUS = new Set([
  "out_of_range",
  "device_mismatch",
  "not_enrolled",
]);

function describe(r: Rejection): string {
  const label = REASON_LABEL[r.reason] ?? r.reason;
  if (r.reason === "out_of_range" && r.distance_m != null) {
    const d = r.distance_m;
    const away = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
    return `${label} — ${away} away`;
  }
  return label;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionPanel({
  sectionId,
  sessionId,
  isOpen,
  roomCode,
  roomName,
  qrDataUrl,
  attendees,
  rejections,
  enrolledCount,
}: {
  sectionId: string;
  sessionId: string | null;
  isOpen: boolean;
  roomCode: string | null;
  roomName: string | null;
  qrDataUrl: string | null;
  attendees: Attendee[];
  rejections: Rejection[];
  enrolledCount: number;
}) {
  const router = useRouter();

  // While the class is open, pull in new scans so students appear as they
  // arrive.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [isOpen, router]);

  if (!roomCode) {
    return (
      <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
        <p className="text-sm text-[#A8321F]">
          This section has no laboratory assigned, so attendance can't be
          opened. Ask the administrator to assign one.
        </p>
      </div>
    );
  }

  // Absent rows are written by close_session, not by a scan. They belong in
  // the report, not in a live view of who has walked in.
  const scannedIn = attendees.filter(
    (a) => a.status === "present" || a.status === "late",
  );
  const present = scannedIn.filter((a) => a.status === "present").length;
  const late = scannedIn.filter((a) => a.status === "late").length;
  const notYetIn = Math.max(0, enrolledCount - scannedIn.length);

  return (
    <div
      className="rounded-lg p-6 border-2 transition-colors"
      style={{
        borderColor: isOpen ? "#0B6E5F" : "#D8DFE5",
        backgroundColor: isOpen ? "#F2F8F6" : "#FFFFFF",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A]">
            Laboratory {roomCode}
          </p>
          <p className="mt-1 text-lg font-medium">
            {isOpen ? "Attendance is open" : "Attendance is closed"}
          </p>
          <p className="mt-1 text-sm text-[#5A6B7A]">
            {isOpen
              ? "Students can scan the code now."
              : "Scans are rejected until you open the class."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {sessionId && (
            <a
              href={`/api/sessions/${sessionId}/report`}
              className="border border-[#16202B] rounded py-3 px-5 text-sm hover:bg-[#16202B] hover:text-white transition-colors"
            >
              Download PDF
            </a>
          )}
          <form action={isOpen ? endSession : startSession}>
            <input type="hidden" name="sectionId" value={sectionId} />
            {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
            <button
              type="submit"
              className="rounded py-3 px-6 text-sm tracking-wide text-white transition-colors"
              style={{ backgroundColor: isOpen ? "#A8321F" : "#0B6E5F" }}
            >
              {isOpen ? "End class" : "Start class"}
            </button>
          </form>
        </div>
      </div>

      {isOpen && qrDataUrl && (
        <QrDisplay
          dataUrl={qrDataUrl}
          roomCode={roomCode}
          roomName={roomName ?? roomCode}
        />
      )}

      {isOpen && (
        <div className="mt-6 pt-6 border-t border-[#D3E3DE]">
          <div className="flex gap-8">
            <div>
              <p className="font-mono text-3xl leading-none">{present}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                Present
              </p>
            </div>
            <div>
              <p
                className="font-mono text-3xl leading-none"
                style={{ color: late > 0 ? "#A8321F" : undefined }}
              >
                {late}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                Late
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl leading-none text-[#5A6B7A]">
                {notYetIn}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                Not yet in
              </p>
            </div>
          </div>

          {rejections.length > 0 && (
            <div className="mt-6 rounded-lg border-2 border-[#A8321F] bg-[#FDF4F2] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-[#A8321F]">
                  {rejections.length} refused{" "}
                  {rejections.length === 1 ? "attempt" : "attempts"}
                </p>
                {rejections.some((r) => SUSPICIOUS.has(r.reason)) && (
                  <p className="text-xs text-[#A8321F]">Worth checking</p>
                )}
              </div>

              <ul className="mt-3 space-y-2">
                {rejections.map((r, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[#16202B]">
                        {r.full_name}{" "}
                        <span className="font-mono text-xs text-[#5A6B7A]">
                          {r.student_no}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-[#5A6B7A] shrink-0">
                        {timeOf(r.at)}
                      </span>
                    </div>
                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color: SUSPICIOUS.has(r.reason) ? "#A8321F" : "#5A6B7A",
                      }}
                    >
                      {describe(r)}
                    </p>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs text-[#5A6B7A] leading-relaxed">
                These scans were not recorded as attendance. They appear in the
                PDF too.
              </p>
            </div>
          )}

          {scannedIn.length > 0 && (
            <ul className="mt-6 space-y-2">
              {scannedIn.map((a) => (
                <li
                  key={a.student_no}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span>
                    {a.full_name}{" "}
                    <span className="font-mono text-xs text-[#5A6B7A]">
                      {a.student_no}
                    </span>
                  </span>
                  <span
                    className="font-mono text-xs"
                    style={{ color: a.status === "late" ? "#A8321F" : "#5A6B7A" }}
                  >
                    {new Date(a.scanned_at).toLocaleTimeString("en-PH", {
                      timeZone: "Asia/Manila",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {a.status === "late" && " late"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

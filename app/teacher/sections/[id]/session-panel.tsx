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
};

const REASON_LABEL: Record<string, string> = {
  not_enrolled: "not in this class",
  out_of_range: "too far away",
  already_marked: "already marked in",
  device_mismatch: "different phone",
  no_open_session: "no class open",
  invalid_code: "unrecognised code",
  device_not_bound: "phone not registered",
  unauthenticated: "not signed in",
};

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
            <div className="mt-6 pt-5 border-t border-[#D3E3DE]">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[#A8321F]">
                Refused scans
              </p>
              <ul className="mt-2 space-y-1.5">
                {rejections.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 text-sm text-[#5A6B7A]"
                  >
                    <span>
                      {r.full_name}{" "}
                      <span className="font-mono text-xs">{r.student_no}</span>
                    </span>
                    <span className="text-xs" style={{ color: "#A8321F" }}>
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                  </li>
                ))}
              </ul>
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

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startSession, endSession } from "./session-actions";

type Attendee = {
  full_name: string;
  student_no: string;
  status: string;
  scanned_at: string;
};

export default function SessionPanel({
  sectionId,
  sessionId,
  isOpen,
  roomCode,
  attendees,
  enrolledCount,
}: {
  sectionId: string;
  sessionId: string | null;
  isOpen: boolean;
  roomCode: string | null;
  attendees: Attendee[];
  enrolledCount: number;
}) {
  const router = useRouter();

  // While the class is open, pull in new scans so the teacher sees students
  // appear as they arrive.
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => router.refresh(), 8000);
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

  const present = attendees.filter((a) => a.status === "present").length;
  const late = attendees.filter((a) => a.status === "late").length;

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
              ? "Students can scan the code on the door now."
              : "Scans are rejected until you open the class."}
          </p>
        </div>

        <form action={isOpen ? endSession : startSession}>
          <input type="hidden" name="sectionId" value={sectionId} />
          {sessionId && (
            <input type="hidden" name="sessionId" value={sessionId} />
          )}
          <button
            type="submit"
            className="rounded py-3 px-6 text-sm tracking-wide text-white transition-colors"
            style={{ backgroundColor: isOpen ? "#A8321F" : "#0B6E5F" }}
          >
            {isOpen ? "End class" : "Start class"}
          </button>
        </form>
      </div>

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
              <p className="font-mono text-3xl leading-none" style={{ color: late > 0 ? "#A8321F" : undefined }}>
                {late}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                Late
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl leading-none text-[#5A6B7A]">
                {enrolledCount - attendees.length}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                Not yet in
              </p>
            </div>
          </div>

          {attendees.length > 0 && (
            <ul className="mt-6 space-y-2">
              {attendees.map((a) => (
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

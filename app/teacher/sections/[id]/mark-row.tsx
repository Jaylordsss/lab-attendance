"use client";

import { useActionState, useState } from "react";
import { markAttendance, type MarkState } from "./mark-actions";
import {
  inputBoxClass,
  selectClass,
  selectChevron,
  Notice,
} from "@/components/admin-ui";

const initial: MarkState = { error: null, success: null };

export type RosterEntry = {
  student_id: string;
  student_no: string;
  full_name: string;
  status: string | null;
  method: string | null;
  scanned_at: string | null;
  override_reason: string | null;
};

const STATUS_COLOUR: Record<string, string> = {
  present: "#0B6E5F",
  late: "#A8321F",
  absent: "#5A6B7A",
  excused: "#5A6B7A",
};

const REASONS = [
  "Phone battery died",
  "Phone left at home",
  "Phone camera not working",
  "Arrived without a signal",
  "Excused by the school",
];

export default function MarkRow({
  sectionId,
  sessionId,
  entry,
}: {
  sectionId: string;
  sessionId: string;
  entry: RosterEntry;
}) {
  const [state, formAction, pending] = useActionState(markAttendance, initial);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const marked = entry.status !== null;
  const wasManual = entry.method === "manual";

  if (!open) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <span className="block">{entry.full_name}</span>
          <span className="block font-mono text-xs text-[#5A6B7A]">
            {entry.student_no}
          </span>
          {wasManual && entry.override_reason && (
            <span className="block text-xs text-[#5A6B7A] italic mt-0.5">
              Marked by hand — {entry.override_reason}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-3 shrink-0">
          {marked ? (
            <span
              className="text-xs uppercase tracking-[0.1em]"
              style={{ color: STATUS_COLOUR[entry.status!] }}
            >
              {entry.status}
            </span>
          ) : (
            <span className="text-xs text-[#B4BFC8]">Not in</span>
          )}

          <button
            onClick={() => setOpen(true)}
            className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            {marked ? "Change" : "Mark"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="studentId" value={entry.student_id} />
      <input type="hidden" name="name" value={entry.full_name} />

      <p className="text-sm font-medium">{entry.full_name}</p>

      <select
        name="status"
        defaultValue={entry.status ?? "present"}
        className={selectClass}
        style={selectChevron}
      >
        <option value="present">Present</option>
        <option value="late">Late</option>
        <option value="excused">Excused</option>
        <option value="absent">Absent</option>
      </select>

      <div>
        <input
          name="reason"
          required
          minLength={10}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why are you marking this by hand?"
          className={`${inputBoxClass} placeholder:text-[#B4BFC8]`}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded border border-[#D8DFE5] px-2 py-1 text-xs text-[#5A6B7A] hover:border-[#0B6E5F] hover:text-[#0B6E5F] transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          The reason is stored with the record and appears in the PDF.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || reason.trim().length < 10}
          className="rounded bg-[#16202B] py-2 px-4 text-xs text-white transition-colors hover:bg-[#0B6E5F] disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[#5A6B7A] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

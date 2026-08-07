"use client";

import { useActionState, useState } from "react";
import {
  previewNumbers,
  confirmNumbers,
  type NumberState,
  type NumberPlan,
} from "./number-actions";
import { buttonClass, Notice, Th, Td } from "@/components/admin-ui";

const initial: NumberState = {
  error: null,
  plan: null,
  numbers: null,
  summary: null,
};

const COLOUR: Record<NumberPlan["action"], string> = {
  enrol: "#0B6E5F",
  skip: "#5A6B7A",
  missing: "#A8321F",
  duplicate: "#A8321F",
};

const LABEL: Record<NumberPlan["action"], string> = {
  enrol: "Will be added",
  skip: "Already in",
  missing: "No account",
  duplicate: "Listed twice",
};

export default function NumberForm({ sectionId }: { sectionId: string }) {
  const [preview, previewAction, previewing] = useActionState(
    previewNumbers,
    initial,
  );
  const [confirm, confirmAction, confirming] = useActionState(
    confirmNumbers,
    initial,
  );
  const [numbers, setNumbers] = useState("");

  if (confirm.summary) {
    return (
      <div className="rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-6 space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "#0B6E5F" }}>
          Roster updated
        </h2>
        <p className="text-sm text-[#5A6B7A]">{confirm.summary}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${buttonClass} w-full`}
        >
          Add more
        </button>
      </div>
    );
  }

  if (preview.plan) {
    const counts = preview.plan.reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {});

    const willAdd = counts.enrol ?? 0;

    return (
      <div className="space-y-5">
        <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
          <h2 className="text-sm font-medium">What this will do</h2>

          <div className="mt-3 flex gap-6 flex-wrap">
            {(["enrol", "skip", "missing", "duplicate"] as const).map((a) =>
              counts[a] ? (
                <div key={a}>
                  <p
                    className="font-mono text-2xl leading-none"
                    style={{ color: COLOUR[a] }}
                  >
                    {counts[a]}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                    {LABEL[a]}
                  </p>
                </div>
              ) : null,
            )}
          </div>

          <div className="mt-5 max-h-80 overflow-y-auto border-t border-[#E2E8ED] pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8ED]">
                  <Th>Student number</Th>
                  <Th>Name</Th>
                  <Th>What happens</Th>
                </tr>
              </thead>
              <tbody>
                {preview.plan.map((r, i) => (
                  <tr key={i} className="border-b border-[#F0F3F5]">
                    <Td><span className="font-mono">{r.studentNo}</span></Td>
                    <Td>{r.fullName}</Td>
                    <Td>
                      <span style={{ color: COLOUR[r.action] }}>{r.note}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {counts.missing ? (
            <p className="mt-4 text-xs text-[#5A6B7A] leading-relaxed">
              Numbers with no account are skipped. Those students need creating
              first — use the full roster import, which carries their details.
            </p>
          ) : null}
        </div>

        <form action={confirmAction} className="flex gap-3 flex-wrap">
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="numbers" value={preview.numbers ?? ""} />
          <button
            type="submit"
            disabled={confirming || willAdd === 0}
            className={buttonClass}
          >
            {confirming
              ? "Enrolling…"
              : `Enrol ${willAdd} student${willAdd === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-[#5A6B7A] underline underline-offset-4"
          >
            Start again
          </button>
        </form>

        {confirm.error && <Notice>{confirm.error}</Notice>}
      </div>
    );
  }

  return (
    <form
      action={previewAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <input type="hidden" name="sectionId" value={sectionId} />

      <div>
        <p className="text-sm font-medium">Student numbers</p>
        <textarea
          name="numbers"
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={"2024-00123\n2024-00124\n2024-00125"}
          className="mt-2 w-full rounded border border-[#D8DFE5] p-3 font-mono text-sm outline-none focus:border-[#0B6E5F] placeholder:text-[#B4BFC8]"
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          One per line, or separated by commas — paste a column straight from a
          spreadsheet.
        </p>
      </div>

      {preview.error && <Notice>{preview.error}</Notice>}

      <button
        type="submit"
        disabled={previewing || !numbers.trim()}
        className={`${buttonClass} w-full`}
      >
        {previewing ? "Checking…" : "Check the list"}
      </button>

      <p className="border-t border-[#E2E8ED] pt-5 text-xs text-[#5A6B7A] leading-relaxed">
        This only adds students who already have an account. Nobody is created,
        so no other details are needed.
      </p>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { removeAllStudents } from "./actions";
import type { EnrolState } from "./actions";
import { inputBoxClass, Notice } from "@/components/admin-ui";

const initial: EnrolState = { error: null, created: null, info: null };

export default function ClearRoster({
  sectionId,
  count,
}: {
  sectionId: string;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(
    removeAllStudents,
    initial,
  );
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
      >
        Remove all students
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 rounded-lg border-2 border-[#A8321F] bg-[#FDF4F2] p-4 space-y-3"
    >
      <input type="hidden" name="sectionId" value={sectionId} />

      <p className="text-sm font-medium" style={{ color: "#A8321F" }}>
        Remove all {count} students from this section?
      </p>
      <p className="text-sm text-[#5A6B7A] leading-relaxed">
        Their accounts and attendance history stay — they are only taken off
        this roster. This cannot be undone from here.
      </p>

      <div>
        <label htmlFor="confirm" className="text-xs text-[#5A6B7A]">
          Type <span className="font-mono font-medium">REMOVE ALL</span> to
          confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className={`${inputBoxClass} mt-1 font-mono`}
        />
      </div>

      {state.error && <Notice>{state.error}</Notice>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#A8321F] py-2 px-4 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Removing…" : "Remove all"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-[#5A6B7A] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

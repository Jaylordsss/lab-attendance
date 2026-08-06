"use client";

import { useActionState, useState } from "react";
import { Notice } from "@/components/admin-ui";

export type DeleteState = { error: string | null };

/**
 * A two-step delete.
 *
 * The action redirects on success rather than returning, so this component
 * only ever renders a failure. An earlier version navigated away on click and
 * left the error unread — the delete had been refused, the page had moved on,
 * and the record was still there with no explanation.
 */
export default function ConfirmDelete({
  action,
  hidden,
  label = "Delete",
  question,
  note,
  confirmLabel = "Yes, delete",
  size = "sm",
}: {
  action: (
    prev: DeleteState,
    formData: FormData,
  ) => Promise<DeleteState>;
  /** Values the action needs, e.g. { id, name }. */
  hidden: Record<string, string>;
  label?: string;
  question: string;
  note: string;
  confirmLabel?: string;
  size?: "sm" | "md";
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [open, setOpen] = useState(false);

  const text = size === "sm" ? "text-xs" : "text-sm";

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          className={`${text} text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]`}
        >
          {label}
        </button>
        {state.error && (
          <div className="mt-2">
            <Notice>{state.error}</Notice>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 min-w-[200px]">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <p className={`${text} font-medium`}>{question}</p>
      <p className={`${text} text-[#5A6B7A] leading-relaxed`}>{note}</p>

      {state.error && <Notice>{state.error}</Notice>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`rounded bg-[#A8321F] py-1.5 px-3 ${text} text-white disabled:opacity-50`}
        >
          {pending ? "Deleting…" : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={`${text} text-[#5A6B7A] underline underline-offset-4`}
        >
          No, cancel
        </button>
      </div>
    </form>
  );
}

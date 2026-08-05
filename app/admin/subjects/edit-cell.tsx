"use client";

import { useActionState, useState } from "react";
import { updateSubject, type SubjectState } from "./actions";
import { inputBoxClass, labelClass, Notice } from "@/components/admin-ui";

const initial: SubjectState = { error: null, success: null };

export default function EditSubjectCell({
  id,
  code,
  title,
}: {
  id: string;
  code: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(updateSubject, initial);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div>
        <span>{title}</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-2 text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 min-w-[220px]">
      <input type="hidden" name="id" value={id} />

      <div>
        <label className={labelClass}>Code</label>
        <input
          name="code"
          defaultValue={code}
          required
          maxLength={20}
          autoCapitalize="characters"
          className={`${inputBoxClass} font-mono`}
        />
      </div>

      <div>
        <label className={labelClass}>Title</label>
        <input
          name="title"
          defaultValue={title}
          required
          autoFocus
          className={inputBoxClass}
        />
      </div>

      {state.error && <Notice>{state.error}</Notice>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#16202B] py-1.5 px-4 text-xs text-white hover:bg-[#0B6E5F] transition-colors disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-[#5A6B7A] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

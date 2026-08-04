"use client";

import { useActionState } from "react";
import { createSubject, type SubjectState } from "./actions";
import { fieldClass, labelClass, buttonClass, Notice } from "@/components/admin-ui";

const initial: SubjectState = { error: null, success: null };

export default function SubjectForm() {
  const [state, formAction, pending] = useActionState(createSubject, initial);

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-sm font-medium">Add a subject</h2>

      <div>
        <label htmlFor="code" className={labelClass}>Code</label>
        <input
          id="code"
          name="code"
          required
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="GEN-SCI"
          className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div>
        <label htmlFor="title" className={labelClass}>Title</label>
        <input
          id="title"
          name="title"
          required
          placeholder="General Science"
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Add subject"}
      </button>
    </form>
  );
}

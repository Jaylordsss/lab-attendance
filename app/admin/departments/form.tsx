"use client";

import { useActionState } from "react";
import { createDepartment, type DeptState } from "./actions";
import {
  inputBoxClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: DeptState = { error: null, success: null };

export default function DeptForm() {
  const [state, formAction, pending] = useActionState(createDepartment, initial);

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-sm font-medium">Add a department</h2>

      <div>
        <label htmlFor="name" className={labelClass}>Full name</label>
        <input
          id="name"
          name="name"
          required
          maxLength={60}
          placeholder="College of Information Technology"
          className={`${inputBoxClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div>
        <label htmlFor="code" className={labelClass}>Short name</label>
        <input
          id="code"
          name="code"
          required
          maxLength={10}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="CITE"
          className={`${inputBoxClass} font-mono placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A]">
          2–10 characters. Used wherever space is tight.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Add department"}
      </button>
    </form>
  );
}

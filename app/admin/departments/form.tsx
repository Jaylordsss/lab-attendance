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
        <label htmlFor="name" className={labelClass}>Name</label>
        <input
          id="name"
          name="name"
          required
          maxLength={60}
          placeholder="Science"
          className={`${inputBoxClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Add department"}
      </button>
    </form>
  );
}

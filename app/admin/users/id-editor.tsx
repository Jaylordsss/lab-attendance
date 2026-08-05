"use client";

import { useActionState, useState } from "react";
import { updateIdentifier, type EditState } from "./actions";
import { DEPARTMENTS } from "@/lib/auth";
import {
  inputBoxClass,
  selectClass,
  selectChevron,
  Notice,
} from "@/components/admin-ui";

const initial: EditState = { error: null, success: null };

export default function IdEditor({
  userId,
  role,
  identifier,
  department,
  departments,
}: {
  userId: string;
  role: string;
  identifier: string | null;
  department: string | null;
  departments: string[];
}) {
  const [state, formAction, pending] = useActionState(updateIdentifier, initial);
  const [editing, setEditing] = useState(false);

  const isStaff = role !== "student";
  const options = Array.from(new Set([...departments, ...DEPARTMENTS]));

  if (!editing) {
    return (
      <div>
        <span className="font-mono">{identifier ?? "—"}</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-2 text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          {identifier ? "Edit" : "Assign"}
        </button>
        {state.success && (
          <span className="block text-xs mt-1" style={{ color: "#0B6E5F" }}>
            {state.success}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 min-w-[190px]">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />

      <input
        name="identifier"
        defaultValue={identifier ?? ""}
        required
        autoFocus
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={isStaff ? "T-2026-001" : "2024-00123"}
        className={`${inputBoxClass} font-mono placeholder:text-[#B4BFC8]`}
      />

      {isStaff && (
        <select
          name="department"
          defaultValue={department ?? ""}
          required
          className={selectClass}
          style={selectChevron}
        >
          <option value="" disabled>Choose department</option>
          {options.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      )}

      {state.error && <Notice>{state.error}</Notice>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-[#16202B] text-white rounded py-1.5 px-4 text-xs hover:bg-[#0B6E5F] transition-colors disabled:opacity-50"
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

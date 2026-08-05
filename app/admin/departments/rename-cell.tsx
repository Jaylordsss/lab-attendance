"use client";

import { useActionState, useState } from "react";
import { renameDepartment, type DeptState } from "./actions";
import { inputBoxClass, Notice } from "@/components/admin-ui";

const initial: DeptState = { error: null, success: null };

export default function RenameCell({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(renameDepartment, initial);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div>
        <span>{name}</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-2 text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 min-w-[200px]">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="oldName" value={name} />
      <input
        name="name"
        defaultValue={name}
        required
        autoFocus
        maxLength={60}
        className={inputBoxClass}
      />
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

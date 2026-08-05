"use client";

import { useActionState, useState } from "react";
import {
  resetPassword,
  setPassword,
  unbindDevice,
  type PasswordResult,
  type EditState,
} from "./actions";
import { inputBoxClass, Notice } from "@/components/admin-ui";

const noPassword: PasswordResult = { error: null, password: null, name: null };
const noEdit: EditState = { error: null, success: null };

type Mode = "idle" | "confirmReset" | "setPassword" | "confirmUnbind";

const linkClass =
  "text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F] text-left";

export default function UserActions({
  userId,
  name,
  isStudent,
}: {
  userId: string;
  name: string;
  isStudent: boolean;
}) {
  const [mode, setMode] = useState<Mode>("idle");

  const [reset, resetAction, resetting] = useActionState(
    resetPassword,
    noPassword,
  );
  const [chosen, chosenAction, choosing] = useActionState(
    setPassword,
    noPassword,
  );
  const [unbind, unbindAction, unbinding] = useActionState(
    unbindDevice,
    noEdit,
  );

  const issued = reset.password ?? chosen.password;

  // Shown once. There is no way to retrieve it afterwards, which is the point.
  if (issued) {
    return (
      <div className="min-w-[190px] space-y-2">
        <p className="text-xs text-[#5A6B7A]">New password for {name}</p>
        <p className="font-mono text-sm break-all bg-[#F2F8F6] border border-[#B7CFC9] rounded px-2 py-1.5">
          {issued}
        </p>
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          Write it down now — it can't be shown again. They'll be asked to
          choose their own at sign-in.
        </p>
      </div>
    );
  }

  if (mode === "confirmReset") {
    return (
      <Confirm
        question={`Reset ${name}'s password?`}
        note="Their current password stops working immediately."
        confirmLabel={resetting ? "Resetting…" : "Yes, reset"}
        pending={resetting}
        action={resetAction}
        userId={userId}
        name={name}
        onCancel={() => setMode("idle")}
        error={reset.error}
      />
    );
  }

  if (mode === "confirmUnbind") {
    return (
      <Confirm
        question={`Unbind ${name}'s phone?`}
        note="The next phone they scan from becomes their registered one."
        confirmLabel={unbinding ? "Unbinding…" : "Yes, unbind"}
        pending={unbinding}
        action={unbindAction}
        userId={userId}
        name={name}
        onCancel={() => setMode("idle")}
        error={unbind.error}
      />
    );
  }

  if (mode === "setPassword") {
    return (
      <form action={chosenAction} className="min-w-[190px] space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="name" value={name} />
        <p className="text-xs text-[#5A6B7A]">New password for {name}</p>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoFocus
          autoComplete="off"
          placeholder="At least 8 characters"
          className={`${inputBoxClass} font-mono placeholder:text-[#B4BFC8]`}
        />
        {chosen.error && <Notice>{chosen.error}</Notice>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={choosing}
            className="bg-[#16202B] text-white rounded py-1.5 px-3 text-xs hover:bg-[#0B6E5F] transition-colors disabled:opacity-50"
          >
            {choosing ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className={linkClass}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <button onClick={() => setMode("confirmReset")} className={linkClass}>
        Reset password
      </button>
      <button onClick={() => setMode("setPassword")} className={linkClass}>
        Set password
      </button>
      {isStudent && (
        <button onClick={() => setMode("confirmUnbind")} className={linkClass}>
          Unbind phone
        </button>
      )}
      {unbind.success && (
        <span className="text-xs" style={{ color: "#0B6E5F" }}>
          {unbind.success}
        </span>
      )}
    </div>
  );
}

function Confirm({
  question,
  note,
  confirmLabel,
  pending,
  action,
  userId,
  name,
  onCancel,
  error,
}: {
  question: string;
  note: string;
  confirmLabel: string;
  pending: boolean;
  action: (formData: FormData) => void;
  userId: string;
  name: string;
  onCancel: () => void;
  error: string | null;
}) {
  return (
    <form action={action} className="min-w-[190px] space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="name" value={name} />
      <p className="text-xs font-medium">{question}</p>
      <p className="text-xs text-[#5A6B7A] leading-relaxed">{note}</p>
      {error && <Notice>{error}</Notice>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-[#A8321F] text-white rounded py-1.5 px-3 text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[#5A6B7A] underline underline-offset-4"
        >
          No, cancel
        </button>
      </div>
    </form>
  );
}

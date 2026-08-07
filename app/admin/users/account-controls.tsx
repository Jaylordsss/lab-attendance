"use client";

import { useActionState, useState } from "react";
import {
  suspendAccount,
  reactivateAccount,
  deleteAccount,
  type AccountState,
} from "./account-actions";
import { inputBoxClass, Notice } from "@/components/admin-ui";

const initial: AccountState = { error: null, success: null };

type Mode = "idle" | "suspend" | "delete";

const linkClass =
  "text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F] text-left";

export default function AccountControls({
  userId,
  name,
  suspended,
  isSelf,
}: {
  userId: string;
  name: string;
  suspended: boolean;
  isSelf: boolean;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [suspend, suspendAction, suspending] = useActionState(
    suspendAccount,
    initial,
  );
  const [restore, restoreAction, restoring] = useActionState(
    reactivateAccount,
    initial,
  );
  const [remove, removeAction, removing] = useActionState(
    deleteAccount,
    initial,
  );

  // Your own account is the one that cannot be locked or removed: the setup
  // route closes for good once an administrator exists, so there would be no
  // way back in.
  if (isSelf) {
    return (
      <span className="text-xs text-[#B4BFC8]">Your account</span>
    );
  }

  if (suspended) {
    return (
      <form action={restoreAction} className="flex flex-col items-start gap-1">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="name" value={name} />
        <button type="submit" disabled={restoring} className={linkClass}>
          {restoring ? "Restoring…" : "Reactivate"}
        </button>
        {restore.error && <Notice>{restore.error}</Notice>}
      </form>
    );
  }

  if (mode === "suspend") {
    return (
      <form action={suspendAction} className="space-y-2 min-w-[190px]">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="name" value={name} />
        <p className="text-xs font-medium">Suspend {name}?</p>
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          They can&rsquo;t sign in but stay on their rosters, and you can undo
          it at any time. Better than deleting for anyone who might return.
        </p>
        {suspend.error && <Notice>{suspend.error}</Notice>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={suspending}
            className="rounded bg-[#A8321F] py-1.5 px-3 text-xs text-white disabled:opacity-50"
          >
            {suspending ? "Suspending…" : "Yes, suspend"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-xs text-[#5A6B7A] underline underline-offset-4"
          >
            No, cancel
          </button>
        </div>
      </form>
    );
  }

  if (mode === "delete") {
    return (
      <form action={removeAction} className="space-y-2 min-w-[190px]">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="name" value={name} />
        <p className="text-xs font-medium" style={{ color: "#A8321F" }}>
          Delete {name} permanently?
        </p>
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          For a student who has transferred or left. Their attendance record
          stays in the register and in every PDF — only the account goes. This
          cannot be undone.
        </p>
        <input
          name="confirm"
          required
          autoFocus
          autoComplete="off"
          placeholder="Type DELETE"
          className={`${inputBoxClass} font-mono text-xs`}
        />
        {remove.error && <Notice>{remove.error}</Notice>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={removing}
            className="rounded bg-[#A8321F] py-1.5 px-3 text-xs text-white disabled:opacity-50"
          >
            {removing ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-xs text-[#5A6B7A] underline underline-offset-4"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button onClick={() => setMode("suspend")} className={linkClass}>
        Suspend
      </button>
      <button
        onClick={() => setMode("delete")}
        className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F] text-left"
      >
        Delete account
      </button>
      {(suspend.success || remove.success) && (
        <span className="text-xs" style={{ color: "#0B6E5F" }}>
          {suspend.success ?? remove.success}
        </span>
      )}
    </div>
  );
}

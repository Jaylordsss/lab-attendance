"use client";

import { useActionState, useState } from "react";
import {
  resetStudentPassword,
  unbindStudentDevice,
  type StudentActionState,
} from "./student-actions";
import { Notice } from "@/components/admin-ui";

const initial: StudentActionState = {
  error: null,
  success: null,
  password: null,
};

type Mode = "idle" | "confirmReset" | "confirmUnbind";

const linkClass =
  "text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F] text-left";

/**
 * The two things a teacher needs mid-class: a student whose password is
 * forgotten, and a student on a new phone.
 */
export default function StudentFixes({
  sectionId,
  studentId,
  name,
}: {
  sectionId: string;
  studentId: string;
  name: string;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const [reset, resetAction, resetting] = useActionState(
    resetStudentPassword,
    initial,
  );
  const [unbind, unbindAction, unbinding] = useActionState(
    unbindStudentDevice,
    initial,
  );

  // Shown once. There is no way to retrieve it afterwards, which is the point.
  if (reset.password) {
    return (
      <div className="mt-2 rounded border border-[#B7CFC9] bg-[#F2F8F6] p-3 space-y-1.5">
        <p className="text-xs text-[#5A6B7A]">New password for {name}</p>
        <p className="font-mono text-sm break-all">{reset.password}</p>
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          Read it out now — it can&rsquo;t be shown again. They&rsquo;ll be
          asked to choose their own when they sign in.
        </p>
      </div>
    );
  }

  if (mode !== "idle") {
    const isReset = mode === "confirmReset";
    return (
      <form
        action={isReset ? resetAction : unbindAction}
        className="mt-2 space-y-2"
      >
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="name" value={name} />

        <p className="text-xs">
          {isReset
            ? `Give ${name} a new password?`
            : `Let ${name} scan from a different phone?`}
        </p>
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          {isReset
            ? "Their current password stops working straight away."
            : "The next phone they scan from becomes their registered one."}
        </p>

        {(isReset ? reset.error : unbind.error) && (
          <Notice>{isReset ? reset.error : unbind.error}</Notice>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isReset ? resetting : unbinding}
            className="rounded bg-[#A8321F] py-1.5 px-3 text-xs text-white disabled:opacity-50"
          >
            {(isReset ? resetting : unbinding) ? "Working…" : "Yes"}
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

  return (
    <div className="mt-1 flex gap-4">
      <button onClick={() => setMode("confirmReset")} className={linkClass}>
        Reset password
      </button>
      <button onClick={() => setMode("confirmUnbind")} className={linkClass}>
        Unbind phone
      </button>
      {unbind.success && (
        <span className="text-xs" style={{ color: "#0B6E5F" }}>
          {unbind.success}
        </span>
      )}
    </div>
  );
}

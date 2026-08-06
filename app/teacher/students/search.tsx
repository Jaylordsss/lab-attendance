"use client";

import { useActionState, useState } from "react";
import {
  findStudent,
  resetPassword,
  unbindDevice,
  type SearchState,
} from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: SearchState = {
  error: null,
  student: null,
  password: null,
  message: null,
};

export default function StudentSearch() {
  const [search, searchAction, searching] = useActionState(
    findStudent,
    initial,
  );
  const [reset, resetAction, resetting] = useActionState(
    resetPassword,
    initial,
  );
  const [unbind, unbindAction, unbinding] = useActionState(
    unbindDevice,
    initial,
  );

  const [confirming, setConfirming] = useState<"none" | "reset" | "unbind">(
    "none",
  );

  const student = search.student;

  /* ---- the new password, shown once ------------------------------- */
  if (reset.password) {
    return (
      <div className="rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-6 space-y-4">
        <h2 className="text-sm font-medium">
          New password for {reset.message}
        </h2>
        <p className="font-mono text-2xl break-all bg-white border border-[#B7CFC9] rounded px-3 py-2">
          {reset.password}
        </p>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Read it out now — it can&rsquo;t be shown again. They sign in with
          their student number and this password, then choose their own.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${buttonClass} w-full`}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        action={searchAction}
        className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
      >
        <div>
          <label htmlFor="studentNo" className={labelClass}>
            Student number
          </label>
          <input
            id="studentNo"
            name="studentNo"
            required
            autoFocus
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="2024-00123"
            className={`${fieldClass} font-mono text-lg tracking-[0.06em] placeholder:tracking-normal placeholder:text-[#B4BFC8]`}
          />
          <p className="mt-2 text-xs text-[#5A6B7A]">
            The full number, exactly as printed on their ID.
          </p>
        </div>

        {search.error && <Notice>{search.error}</Notice>}

        <button
          type="submit"
          disabled={searching}
          className={`${buttonClass} w-full`}
        >
          {searching ? "Searching…" : "Find student"}
        </button>
      </form>

      {student && (
        <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5">
          <div>
            <h2 className="font-medium">{student.full_name}</h2>
            <p className="font-mono text-sm text-[#5A6B7A]">
              {student.student_no}
            </p>
            <p className="mt-1 text-sm text-[#5A6B7A]">
              {student.section_names}
            </p>
          </div>

          <dl className="text-sm space-y-2 border-l-2 border-[#E2E8ED] pl-4">
            <div className="flex justify-between gap-3">
              <dt className="text-[#5A6B7A]">Phone registered</dt>
              <dd>{student.device_bound ? "Yes" : "Not yet"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#5A6B7A]">Password</dt>
              <dd>
                {student.needs_password ? "Temporary" : "Set by the student"}
              </dd>
            </div>
          </dl>

          {(unbind.message || unbind.error) && (
            <Notice kind={unbind.error ? "error" : "success"}>
              {unbind.error ?? unbind.message}
            </Notice>
          )}
          {reset.error && <Notice>{reset.error}</Notice>}

          {confirming === "reset" ? (
            <Confirm
              action={resetAction}
              student={student}
              pending={resetting}
              question={`Give ${student.full_name} a new password?`}
              note="A random one is generated and shown once. Their current password stops working straight away."
              onCancel={() => setConfirming("none")}
            />
          ) : confirming === "unbind" ? (
            <Confirm
              action={unbindAction}
              student={student}
              pending={unbinding}
              question={`Unbind ${student.full_name}'s phone?`}
              note="The next phone they scan from becomes their registered one."
              onCancel={() => setConfirming("none")}
            />
          ) : (
            <div className="flex flex-col items-start gap-2">
              <button
                onClick={() => setConfirming("reset")}
                className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
              >
                Reset password
              </button>
              {student.device_bound && (
                <button
                  onClick={() => setConfirming("unbind")}
                  className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
                >
                  Unbind phone
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Confirm({
  action,
  student,
  pending,
  question,
  note,
  onCancel,
}: {
  action: (formData: FormData) => void;
  student: { student_id: string; student_no: string; full_name: string };
  pending: boolean;
  question: string;
  note: string;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="studentId" value={student.student_id} />
      <input type="hidden" name="studentNo" value={student.student_no} />
      <input type="hidden" name="name" value={student.full_name} />

      <p className="text-sm font-medium">{question}</p>
      <p className="text-sm text-[#5A6B7A] leading-relaxed">{note}</p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#A8321F] py-2 px-4 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Working…" : "Yes, do it"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-[#5A6B7A] underline underline-offset-4"
        >
          No, cancel
        </button>
      </div>
    </form>
  );
}

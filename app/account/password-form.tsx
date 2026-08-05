"use client";

import { useActionState } from "react";
import {
  changePassword,
  sendPasswordCode,
  type ActionState,
} from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ActionState = { error: null, success: null };

export default function PasswordForm({ needsCode }: { needsCode: boolean }) {
  const [state, formAction, pending] = useActionState(changePassword, initial);
  const [codeState, sendAction, sending] = useActionState(
    sendPasswordCode,
    initial,
  );

  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5">
      <h2 className="text-sm font-medium">Change your password</h2>

      {needsCode ? (
        <>
          <p className="text-sm text-[#5A6B7A] leading-relaxed">
            We'll email you a one-time code first, so nobody can change your
            password just by picking up your unlocked phone.
          </p>
          <form action={sendAction}>
            <button
              type="submit"
              disabled={sending}
              className="border border-[#16202B] rounded py-2 px-4 text-sm hover:bg-[#16202B] hover:text-white transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Email me a code"}
            </button>
          </form>
          {codeState.error && <Notice>{codeState.error}</Notice>}
          {codeState.success && (
            <Notice kind="success">{codeState.success}</Notice>
          )}
        </>
      ) : (
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Add a confirmed email address above and future password changes will
          require a code sent to it.
        </p>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="needsCode" value={String(needsCode)} />

        {needsCode && (
          <div>
            <label htmlFor="nonce" className={labelClass}>Code from email</label>
            <input
              id="nonce"
              name="nonce"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={`${fieldClass} font-mono tracking-[0.2em] placeholder:tracking-normal placeholder:text-[#B4BFC8]`}
            />
          </div>
        )}

        <div>
          <label htmlFor="password" className={labelClass}>New password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={fieldClass}
          />
          <p className="mt-2 text-xs text-[#5A6B7A]">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClass}>Confirm</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={fieldClass}
          />
        </div>

        {state.error && <Notice>{state.error}</Notice>}

        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} w-full`}
        >
          {pending ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}

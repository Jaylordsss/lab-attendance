"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "./actions";
import { fieldClass, labelClass, buttonClass, Notice } from "@/components/admin-ui";

const initial: PasswordState = { error: null };

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
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

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

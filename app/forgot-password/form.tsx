"use client";

import { useActionState } from "react";
import { sendResetLink, type ForgotState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ForgotState = { error: null, success: null };

export default function ForgotForm() {
  const [state, formAction, pending] = useActionState(sendResetLink, initial);

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <div>
        <label htmlFor="identifier" className={labelClass}>
          ID number or email
        </label>
        <input
          id="identifier"
          name="identifier"
          required
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="2024-00123"
          className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          We&rsquo;ll email a link to the address on the account.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

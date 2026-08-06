"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { sendCode, verifyAndReset, type ForgotState } from "./actions";
import PasswordInput from "@/components/password-input";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ForgotState = {
  error: null,
  sent: false,
  maskedEmail: null,
  done: false,
};

export default function ForgotForm() {
  const [send, sendAction, sending] = useActionState(sendCode, initial);
  const [reset, resetAction, resetting] = useActionState(
    verifyAndReset,
    initial,
  );

  // Kept so step two can resolve the same account without carrying the email
  // address through the browser.
  const [identifier, setIdentifier] = useState("");

  if (reset.done) {
    return (
      <div className="rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-6 space-y-4">
        <h2 className="text-lg font-medium" style={{ color: "#0B6E5F" }}>
          Password changed
        </h2>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Sign in with your ID number and the password you just chose.
        </p>
        <Link
          href="/login"
          className={`${buttonClass} inline-block w-full text-center`}
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  /* ---- step two: code and new password ---------------------------- */
  if (send.sent) {
    return (
      <form
        action={resetAction}
        className="bg-white border-2 border-[#0B6E5F] rounded-lg p-6 space-y-5"
      >
        <input type="hidden" name="identifier" value={identifier} />

        <div>
          <h2 className="text-sm font-medium">Enter the code</h2>
          <p className="mt-1 text-sm text-[#5A6B7A] leading-relaxed">
            {send.maskedEmail
              ? `We sent a code to ${send.maskedEmail}.`
              : "If that account has an email address, a code is on its way."}{" "}
            It can take a minute, and it may land in spam.
          </p>
        </div>

        <div>
          <label htmlFor="token" className={labelClass}>
            Code from your email
          </label>
          <input
            id="token"
            name="token"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={10}
            placeholder="41054260"
            className={`${fieldClass} font-mono text-xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-[#B4BFC8]`}
          />
        </div>

        <PasswordInput
          id="password"
          label="New password"
          hint="At least 8 characters."
          minLength={8}
          autoComplete="new-password"
        />

        <PasswordInput
          id="confirmPassword"
          label="Confirm"
          minLength={8}
          autoComplete="new-password"
        />

        {reset.error && <Notice>{reset.error}</Notice>}

        <button
          type="submit"
          disabled={resetting}
          className={`${buttonClass} w-full`}
        >
          {resetting ? "Changing…" : "Change my password"}
        </button>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs text-[#5A6B7A] underline underline-offset-4"
        >
          Start again
        </button>
      </form>
    );
  }

  /* ---- step one: who are you --------------------------------------- */
  return (
    <form
      action={sendAction}
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
          autoFocus
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="2024-00123"
          className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          We&rsquo;ll email a six-digit code to the address on the account.
        </p>
      </div>

      {send.error && <Notice>{send.error}</Notice>}

      <button
        type="submit"
        disabled={sending}
        className={`${buttonClass} w-full`}
      >
        {sending ? "Sending…" : "Send me a code"}
      </button>
    </form>
  );
}

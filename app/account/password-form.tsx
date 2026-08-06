"use client";

import { useActionState, useState } from "react";
import {
  startPasswordChange,
  confirmPasswordChange,
  setInitialPassword,
  type ActionState,
} from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ActionState = { error: null, success: null };

export default function PasswordForm({
  inSetup = false,
  canUseCode = true,
}: {
  inSetup?: boolean;
  /** False when the account has no real inbox a code could reach. */
  canUseCode?: boolean;
}) {
  const [start, startAction, starting] = useActionState(
    startPasswordChange,
    initial,
  );
  const [confirm, confirmAction, confirming] = useActionState(
    confirmPasswordChange,
    initial,
  );
  const [setup, setupAction, settingUp] = useActionState(
    setInitialPassword,
    initial,
  );

  // Held in memory between the two steps. It never reaches the server until
  // the code comes back with it.
  const [pending, setPending] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);

  // Step one succeeded; the code is on its way.
  if (start.success && !awaitingCode) setAwaitingCode(true);

  /* ---- first run: no current password, no code -------------------- */
  if (inSetup || !canUseCode) {
    return (
      <form
        action={setupAction}
        className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
      >
        <h2 className="text-sm font-medium">
          {inSetup ? "Choose your password" : "Change your password"}
        </h2>

        {!inSetup && (
          <p className="text-sm text-[#5A6B7A] leading-relaxed">
            Add a confirmed email address above and future changes will need a
            code sent to it.
          </p>
        )}

        <Field id="password" label="New password" hint="At least 8 characters." />
        <Field id="confirmPassword" label="Confirm" />

        {setup.error && <Notice>{setup.error}</Notice>}

        <button
          type="submit"
          disabled={settingUp}
          className={`${buttonClass} w-full`}
        >
          {settingUp
            ? "Saving…"
            : inSetup
              ? "Save and continue"
              : "Change password"}
        </button>
      </form>
    );
  }

  /* ---- step two: the code ----------------------------------------- */
  if (awaitingCode) {
    return (
      <form
        action={confirmAction}
        className="bg-white border-2 border-[#0B6E5F] rounded-lg p-6 space-y-5"
      >
        <input type="hidden" name="password" value={pending} />

        <h2 className="text-sm font-medium">Enter the code</h2>
        {start.success && <Notice kind="success">{start.success}</Notice>}

        <div>
          <label htmlFor="nonce" className={labelClass}>
            Code from your email
          </label>
          <input
            id="nonce"
            name="nonce"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className={`${fieldClass} font-mono text-lg tracking-[0.25em] placeholder:tracking-normal placeholder:text-[#B4BFC8]`}
          />
          <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
            Your password has not changed yet. It changes when this code is
            accepted.
          </p>
        </div>

        {confirm.error && <Notice>{confirm.error}</Notice>}

        <button
          type="submit"
          disabled={confirming}
          className={`${buttonClass} w-full`}
        >
          {confirming ? "Confirming…" : "Confirm and change password"}
        </button>

        <button
          type="button"
          onClick={() => {
            setAwaitingCode(false);
            setPending("");
          }}
          className="text-xs text-[#5A6B7A] underline underline-offset-4"
        >
          Start again
        </button>
      </form>
    );
  }

  /* ---- step one: current, new, confirm ---------------------------- */
  return (
    <form
      action={startAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <h2 className="text-sm font-medium">Change your password</h2>

      <div>
        <label htmlFor="currentPassword" className={labelClass}>
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>New password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          className={fieldClass}
        />
        <p className="mt-2 text-xs text-[#5A6B7A]">At least 8 characters.</p>
      </div>

      <Field id="confirmPassword" label="Confirm" />

      {start.error && <Notice>{start.error}</Notice>}

      <button
        type="submit"
        disabled={starting}
        className={`${buttonClass} w-full`}
      >
        {starting ? "Sending code…" : "Continue"}
      </button>

      <p className="text-xs text-[#5A6B7A] leading-relaxed">
        We&rsquo;ll email you a code before the change takes effect. Forgotten
        your password? Students ask their teacher; teachers ask the
        administrator.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
}: {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <input
        id={id}
        name={id}
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        className={fieldClass}
      />
      {hint && <p className="mt-2 text-xs text-[#5A6B7A]">{hint}</p>}
    </div>
  );
}

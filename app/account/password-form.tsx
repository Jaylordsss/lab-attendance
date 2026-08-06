"use client";

import { useActionState } from "react";
import {
  changePassword,
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
}: {
  inSetup?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    inSetup ? setInitialPassword : changePassword,
    initial,
  );

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <h2 className="text-sm font-medium">
        {inSetup ? "Choose your password" : "Change your password"}
      </h2>

      {/* No current password during setup: the one they hold was issued by a
          teacher, so retyping it proves nothing. */}
      {!inSetup && (
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

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : inSetup ? "Save and continue" : "Change password"}
      </button>

      {!inSetup && (
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          Forgotten your current password? Students ask their teacher; teachers
          ask the administrator. Either can issue a new one.
        </p>
      )}
    </form>
  );
}

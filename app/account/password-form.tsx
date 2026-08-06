"use client";

import { useActionState, useState } from "react";
import {
  changePassword,
  setInitialPassword,
  type ActionState,
} from "./actions";
import PasswordInput from "@/components/password-input";
import { buttonClass, Notice } from "@/components/admin-ui";

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

  // Collapsed until asked for. Most visits to this page are not about the
  // password, and three empty fields sitting open read as something left
  // undone.
  const [open, setOpen] = useState(inSetup);

  if (!open) {
    return (
      <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Password</h2>
            <p className="mt-1 text-sm text-[#5A6B7A]">
              Last changed by you, or set by your teacher.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F] shrink-0"
          >
            Change password
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">
          {inSetup ? "Choose your password" : "Change your password"}
        </h2>
        {!inSetup && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-[#5A6B7A] underline underline-offset-4"
          >
            Cancel
          </button>
        )}
      </div>

      {/* No current password during setup: the one they hold was issued by a
          teacher, so retyping it proves nothing. */}
      {!inSetup && (
        <PasswordInput
          id="currentPassword"
          label="Current password"
          autoComplete="current-password"
          autoFocus
        />
      )}

      <PasswordInput
        id="password"
        label="New password"
        hint="At least 8 characters."
        minLength={8}
        autoComplete="new-password"
        autoFocus={inSetup}
      />

      <PasswordInput
        id="confirmPassword"
        label="Confirm"
        minLength={8}
        autoComplete="new-password"
      />

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

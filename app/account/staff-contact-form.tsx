"use client";

import { useActionState } from "react";
import { updateStaffContact, type ActionState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ActionState = { error: null, success: null };

export default function StaffContactForm({
  email,
  contactNo,
}: {
  email: string;
  contactNo: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateStaffContact,
    initial,
  );

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <h2 className="text-sm font-medium">Contact details</h2>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
          className={fieldClass}
        />
        <p className="mt-2 text-xs text-[#5A6B7A]">
          You sign in with this, so it changes your login too.
        </p>
      </div>

      <div>
        <label htmlFor="contactNo" className={labelClass}>Mobile number</label>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-[#5A6B7A] shrink-0">+63</span>
          <input
            id="contactNo"
            name="contactNo"
            type="tel"
            inputMode="numeric"
            defaultValue={contactNo}
            placeholder="917 123 4567"
            className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
          />
        </div>
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

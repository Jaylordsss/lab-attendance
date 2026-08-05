"use client";

import { useActionState, useState } from "react";
import { updateStaffContact, type ActionState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";
import PhoneField from "./phone-field";

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
  const [phoneOk, setPhoneOk] = useState(contactNo.length === 10);

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

      <PhoneField
        id="contactNo"
        name="contactNo"
        label="Mobile number"
        defaultValue={contactNo}
        onComplete={setPhoneOk}
      />

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button
        type="submit"
        disabled={pending || !phoneOk}
        className={`${buttonClass} w-full`}
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

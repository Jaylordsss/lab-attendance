"use client";

import { useActionState, useState } from "react";
import { updateStaffContact, type ActionState } from "./actions";
import PhoneField from "./phone-field";
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

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ email, contactNo });

  const dirty =
    values.email.trim() !== email.trim() ||
    values.contactNo !== contactNo;

  const valid =
    values.email.includes("@") && values.contactNo.length === 10;

  if (!editing) {
    return (
      <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="text-sm font-medium">Contact details</h2>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            Edit details
          </button>
        </div>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className={labelClass}>Email</dt>
            <dd className="font-mono break-all">{email || "Not set"}</dd>
          </div>
          <div>
            <dt className={labelClass}>Mobile number</dt>
            <dd className="font-mono">
              {contactNo ? `+63 ${contactNo}` : "—"}
            </dd>
          </div>
        </dl>

        {state.success && (
          <div className="mt-5">
            <Notice kind="success">{state.success}</Notice>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Editing contact details</h2>
        <button
          type="button"
          onClick={() => {
            setValues({ email, contactNo });
            setEditing(false);
          }}
          className="text-sm text-[#5A6B7A] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={values.email}
          onChange={(e) =>
            setValues((v) => ({ ...v, email: e.target.value }))
          }
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
        onChangeValue={(v) => setValues((prev) => ({ ...prev, contactNo: v }))}
      />

      {state.error && <Notice>{state.error}</Notice>}

      {dirty && (
        <button
          type="submit"
          disabled={pending || !valid}
          className={`${buttonClass} w-full`}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { updateStudentProfile, type ActionState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";
import PhoneField from "./phone-field";

const initial: ActionState = { error: null, success: null };

export default function StudentProfileForm({
  email,
  contactNo,
  guardianName,
  guardianNo,
  address,
  studentNo,
  birthdate,
}: {
  email: string;
  contactNo: string;
  guardianName: string;
  guardianNo: string;
  address: string;
  studentNo: string;
  birthdate: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateStudentProfile,
    initial,
  );

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <h2 className="text-sm font-medium">Your details</h2>

      <dl className="text-sm border-l-2 border-[#E2E8ED] pl-4 space-y-2">
        <div>
          <dt className={labelClass}>Student number</dt>
          <dd className="font-mono">{studentNo}</dd>
        </div>
        <div>
          <dt className={labelClass}>Birthday</dt>
          <dd className="font-mono">{birthdate}</dd>
        </div>
        <p className="text-xs text-[#5A6B7A] pt-1">
          Your name, number and birthday are set by the school. Ask your
          teacher if any of them is wrong.
        </p>
      </dl>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={email}
          autoComplete="email"
          placeholder="you@example.com"
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          Adding one lets you reset your own password. You still sign in with
          your student number.
        </p>
      </div>

      <PhoneField
        id="contactNo"
        name="contactNo"
        label="Your mobile"
        defaultValue={contactNo}
      />

      <div className="pt-2 border-t border-[#E2E8ED]">
        <label htmlFor="guardianName" className={labelClass}>Guardian name</label>
        <input
          id="guardianName"
          name="guardianName"
          defaultValue={guardianName}
          className={fieldClass}
        />
      </div>

      <PhoneField
        id="guardianNo"
        name="guardianNo"
        label="Guardian mobile"
        defaultValue={guardianNo}
      />

      <div>
        <label htmlFor="address" className={labelClass}>Address</label>
        <input
          id="address"
          name="address"
          defaultValue={address}
          className={fieldClass}
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          Your address and guardian details are encrypted. Only administrators
          can read them.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

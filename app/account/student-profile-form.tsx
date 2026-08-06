"use client";

import { useActionState, useState } from "react";
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
  inSetup = false,
  email,
  contactNo,
  guardianName,
  guardianNo,
  address,
  studentNo,
  birthdate,
  department,
}: {
  inSetup?: boolean;
  email: string;
  contactNo: string;
  guardianName: string;
  guardianNo: string;
  address: string;
  studentNo: string;
  birthdate: string;
  department: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateStudentProfile,
    initial,
  );

  // Mirrored in the server action, which is what actually enforces it. This
  // only spares the round trip.
  const [filled, setFilled] = useState({
    contactNo: contactNo.length === 10,
    guardianName: guardianName.trim().length >= 2,
    guardianNo: guardianNo.length === 10,
    address: address.trim().length >= 8,
  });

  const complete = Object.values(filled).every(Boolean);

  const mark = (key: keyof typeof filled, ok: boolean) =>
    setFilled((f) => (f[key] === ok ? f : { ...f, [key]: ok }));

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      {inSetup && <input type="hidden" name="setup" value="1" />}
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
        {department && (
          <div>
            <dt className={labelClass}>Department</dt>
            <dd>{department}</dd>
          </div>
        )}
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
        onComplete={(ok) => mark("contactNo", ok)}
      />

      <div className="pt-2 border-t border-[#E2E8ED]">
        <label htmlFor="guardianName" className={labelClass}>Guardian name</label>
        <input
          id="guardianName"
          name="guardianName"
          required
          defaultValue={guardianName}
          onChange={(e) => mark("guardianName", e.target.value.trim().length >= 2)}
          className={fieldClass}
        />
      </div>

      <PhoneField
        id="guardianNo"
        name="guardianNo"
        label="Guardian mobile"
        defaultValue={guardianNo}
        onComplete={(ok) => mark("guardianNo", ok)}
      />

      <div>
        <label htmlFor="address" className={labelClass}>Address</label>
        <input
          id="address"
          name="address"
          required
          defaultValue={address}
          placeholder="Street, barangay, city, province"
          onChange={(e) => mark("address", e.target.value.trim().length >= 8)}
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          Your address and guardian details are encrypted. Only administrators
          can read them.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      {!complete && (
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          Fill in every field before saving. The school needs a working
          guardian contact for every student.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !complete}
        className={`${buttonClass} w-full`}
      >
        {pending ? "Saving…" : inSetup ? "Save and continue" : "Save changes"}
      </button>
    </form>
  );
}

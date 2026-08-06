"use client";

import { useActionState, useState } from "react";
import { updateStudentProfile, type ActionState } from "./actions";
import PhoneField from "./phone-field";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ActionState = { error: null, success: null };

type Values = {
  email: string;
  contactNo: string;
  guardianName: string;
  guardianNo: string;
  address: string;
};

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

  const saved: Values = { email, contactNo, guardianName, guardianNo, address };

  // Setup has nothing to reveal, so it opens straight into the form.
  const [editing, setEditing] = useState(inSetup);
  const [values, setValues] = useState<Values>(saved);

  const set = (key: keyof Values, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  // Save only appears once something has actually changed. A button that does
  // nothing still invites a tap, and a tap that does nothing reads as a bug.
  const dirty = (Object.keys(saved) as (keyof Values)[]).some(
    (k) => values[k].trim() !== saved[k].trim(),
  );

  const complete =
    values.contactNo.length === 10 &&
    values.guardianNo.length === 10 &&
    values.guardianName.trim().length >= 2 &&
    values.address.trim().length >= 8;

  /* ---------------------------------------------------------------- */

  if (!editing) {
    return (
      <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h2 className="text-sm font-medium">Your details</h2>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            Edit details
          </button>
        </div>

        <Fixed
          studentNo={studentNo}
          birthdate={birthdate}
          department={department}
        />

        <dl className="mt-5 space-y-4 text-sm">
          <Row label="Email" value={saved.email || "Not set"} mono={!!saved.email} />
          <Row label="Your mobile" value={withPrefix(saved.contactNo)} mono />
          <Row label="Guardian name" value={saved.guardianName || "—"} />
          <Row label="Guardian mobile" value={withPrefix(saved.guardianNo)} mono />
          <Row label="Address" value={saved.address || "—"} />
        </dl>

        {state.success && (
          <div className="mt-5">
            <Notice kind="success">{state.success}</Notice>
          </div>
        )}

        <p className="mt-5 text-xs text-[#5A6B7A] leading-relaxed">
          Your address and guardian details are encrypted. Only administrators
          can read them.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      {inSetup && <input type="hidden" name="setup" value="1" />}

      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">
          {inSetup ? "Your details" : "Editing your details"}
        </h2>
        {!inSetup && (
          <button
            type="button"
            onClick={() => {
              setValues(saved);
              setEditing(false);
            }}
            className="text-sm text-[#5A6B7A] underline underline-offset-4"
          >
            Cancel
          </button>
        )}
      </div>

      <Fixed
        studentNo={studentNo}
        birthdate={birthdate}
        department={department}
      />

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
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
        defaultValue={values.contactNo}
        onChangeValue={(v) => set("contactNo", v)}
      />

      <div>
        <label htmlFor="guardianName" className={labelClass}>Guardian name</label>
        <input
          id="guardianName"
          name="guardianName"
          required
          value={values.guardianName}
          onChange={(e) => set("guardianName", e.target.value)}
          className={fieldClass}
        />
      </div>

      <PhoneField
        id="guardianNo"
        name="guardianNo"
        label="Guardian mobile"
        defaultValue={values.guardianNo}
        onChangeValue={(v) => set("guardianNo", v)}
      />

      <div>
        <label htmlFor="address" className={labelClass}>Address</label>
        <input
          id="address"
          name="address"
          required
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Street, barangay, city, province"
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          Your address and guardian details are encrypted. Only administrators
          can read them.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}

      {!complete && (
        <p className="text-xs text-[#5A6B7A] leading-relaxed">
          Fill in every field before saving. The school needs a working
          guardian contact for every student.
        </p>
      )}

      {(dirty || inSetup) && (
        <button
          type="submit"
          disabled={pending || !complete}
          className={`${buttonClass} w-full`}
        >
          {pending ? "Saving…" : inSetup ? "Save and continue" : "Save changes"}
        </button>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */

function Fixed({
  studentNo,
  birthdate,
  department,
}: {
  studentNo: string;
  birthdate: string;
  department: string;
}) {
  return (
    <dl className="text-sm border-l-2 border-[#E2E8ED] pl-4 space-y-3">
      <Row label="Student number" value={studentNo} mono />
      <Row label="Birthday" value={birthdate} mono />
      {department && <Row label="Department" value={department} />}
      <p className="text-xs text-[#5A6B7A] leading-relaxed pt-1">
        Your name, number and birthday are set by the school. Ask your teacher
        if any of them is wrong.
      </p>
    </dl>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className={labelClass}>{label}</dt>
      <dd className={mono ? "font-mono" : undefined}>{value}</dd>
    </div>
  );
}

function withPrefix(digits: string): string {
  if (!digits) return "—";
  return `+63 ${digits}`;
}

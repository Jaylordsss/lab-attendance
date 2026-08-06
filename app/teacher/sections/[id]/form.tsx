"use client";

import { useActionState, useState } from "react";
import { enrolStudent, type EnrolState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  selectClass,
  selectChevron,
  Notice,
} from "@/components/admin-ui";
import Link from "next/link";
import PhoneField from "@/app/account/phone-field";

const initial: EnrolState = { error: null, created: null, info: null };

export default function EnrolForm({
  sectionId,
  departments,
}: {
  sectionId: string;
  departments: { department: string; code: string }[];
}) {
  const [state, formAction, pending] = useActionState(enrolStudent, initial);
  const [showNew, setShowNew] = useState(false);

  if (state.created) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium">{state.created.name} enrolled</h2>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Give them these details. The password is shown once and cannot be
          recovered — students have no email inbox, so a lost password needs an
          administrator to reset it.
        </p>
        <dl className="text-sm space-y-3 border-l-2 border-[#0B6E5F] pl-4">
          <div>
            <dt className={labelClass}>Sign in with</dt>
            <dd className="font-mono">{state.created.studentNo}</dd>
          </div>
          <div>
            <dt className={labelClass}>Temporary password</dt>
            <dd className="font-mono text-lg break-all">{state.created.tempPassword}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${buttonClass} w-full`}
        >
          Enrol another
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="sectionId" value={sectionId} />
      <h2 className="text-sm font-medium">Enrol a student</h2>

      <div>
        <label htmlFor="studentNo" className={labelClass}>Student number</label>
        <input
          id="studentNo"
          name="studentNo"
          required
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="2024-00123"
          className={`${fieldClass} font-mono tracking-[0.06em] placeholder:tracking-normal placeholder:text-[#B4BFC8]`}
        />
        <p className="mt-2 text-xs text-[#5A6B7A]">
          If they already have an account, this is all you need.
        </p>
      </div>

      {!showNew ? (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="text-sm underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          New student — add their details
        </button>
      ) : (
        <div className="space-y-5 border-l-2 border-[#E2E8ED] pl-4">
          <div>
            <label htmlFor="fullName" className={labelClass}>Full name</label>
            <input id="fullName" name="fullName" className={fieldClass} />
          </div>

          <div>
            <label htmlFor="birthdate" className={labelClass}>Birthday</label>
            <input id="birthdate" name="birthdate" type="date" className={`${fieldClass} font-mono`} />
            <p className="mt-2 text-xs text-[#5A6B7A]">
              The app greets them by name when they scan on this day.
            </p>
          </div>

          <div>
            <label htmlFor="department" className={labelClass}>Department</label>
            <select
              id="department"
              name="department"
              required
              defaultValue=""
              className={selectClass}
              style={selectChevron}
            >
              <option value="" disabled>
                {departments.length === 0
                  ? "No departments yet"
                  : "Choose department"}
              </option>
              {departments.map((d) => (
                <option key={d.department} value={d.department}>
                  {d.code} — {d.department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="student@gmail.com"
              className={`${fieldClass} placeholder:text-[#B4BFC8]`}
            />
            <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
              How they reset a forgotten password. They still sign in with
              their student number.
            </p>
          </div>

          <PhoneField
            id="contactNo"
            name="contactNo"
            label="Student mobile"
            hint="Their own number, not the guardian's."
          />

          <div>
            <label htmlFor="address" className={labelClass}>Address</label>
            <input id="address" name="address" className={fieldClass} />
          </div>

          <div>
            <label htmlFor="guardianName" className={labelClass}>Guardian name</label>
            <input id="guardianName" name="guardianName" className={fieldClass} />
          </div>

          <PhoneField
            id="guardianNo"
            name="guardianNo"
            label="Guardian contact"
          />

          <p className="text-xs text-[#5A6B7A] leading-relaxed">
            Address and guardian details are encrypted and visible only to
            administrators.
          </p>
        </div>
      )}

      {state.error && <Notice>{state.error}</Notice>}
      {state.info && <Notice kind="success">{state.info}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Enrolling…" : "Enrol"}
      </button>

      <p className="border-t border-[#E2E8ED] pt-5 text-xs text-[#5A6B7A] leading-relaxed">
        Adding a whole class?{" "}
        <Link
          href={`/teacher/sections/${sectionId}/import`}
          className="underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          Import a roster
        </Link>{" "}
        from a spreadsheet instead.
      </p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { createTeacher, type TeacherState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  selectClass,
  selectChevron,
  Notice,
} from "@/components/admin-ui";
import PhoneField from "@/app/account/phone-field";

const initial: TeacherState = { error: null, created: null };

export default function TeacherForm({
  departments,
}: {
  departments: { department: string; code: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTeacher, initial);

  if (state.created) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium">{state.created.name} added</h2>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Give them these details. The password is shown once and cannot be
          recovered — they'll be asked to choose their own when they sign in.
        </p>
        <dl className="text-sm space-y-3 border-l-2 border-[#0B6E5F] pl-4">
          <div>
            <dt className={labelClass}>Sign in with</dt>
            <dd className="font-mono break-all">{state.created.email}</dd>
          </div>
          <div>
            <dt className={labelClass}>Temporary password</dt>
            <dd className="font-mono text-lg break-all">
              {state.created.password}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${buttonClass} w-full`}
        >
          Add another teacher
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-sm font-medium">Add a teacher</h2>

      <div>
        <label htmlFor="fullName" className={labelClass}>Full name</label>
        <input id="fullName" name="fullName" required className={fieldClass} />
      </div>

      <div>
        <label htmlFor="facultyId" className={labelClass}>Faculty ID</label>
        <input
          id="facultyId"
          name="facultyId"
          required
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="T-2026-002"
          className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
        />
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
            {departments.length === 0 ? "Add a department first" : "Choose department"}
          </option>
          {departments.map((d) => (
            <option key={d.department} value={d.department}>
              {d.code} — {d.department}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={fieldClass}
        />
      </div>

      <PhoneField
        id="contactNo"
        name="contactNo"
        label="Mobile number"
        hint="Optional. Philippine mobile only."
      />

      <p className="text-xs text-[#5A6B7A] leading-relaxed border-t border-[#E2E8ED] pt-5">
        A password is generated automatically and shown once. The teacher
        chooses their own the first time they sign in.
      </p>

      {state.error && <Notice>{state.error}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

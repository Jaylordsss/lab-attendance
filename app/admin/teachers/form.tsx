"use client";

import { useActionState } from "react";
import { createTeacher, type TeacherState } from "./actions";
import { DEPARTMENTS } from "@/lib/auth";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: TeacherState = { error: null, created: null };

export default function TeacherForm() {
  const [state, formAction, pending] = useActionState(createTeacher, initial);

  if (state.created) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium">{state.created.name} added</h2>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Give them these details. The password is shown once and cannot be
          recovered — if it's lost, create a new one from this page.
        </p>
        <dl className="text-sm space-y-3 border-l-2 border-[#0B6E5F] pl-4">
          <div>
            <dt className={labelClass}>Sign in with</dt>
            <dd className="font-mono break-all">{state.created.email}</dd>
          </div>
          <div>
            <dt className={labelClass}>Temporary password</dt>
            <dd className="font-mono text-lg break-all">
              {state.created.tempPassword}
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
        <label htmlFor="fullName" className={labelClass}>
          Full name
        </label>
        <input id="fullName" name="fullName" required className={fieldClass} />
      </div>

      <div>
        <label htmlFor="facultyId" className={labelClass}>
          Faculty ID
        </label>
        <input
          id="facultyId"
          name="facultyId"
          required
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="T-2024-002"
          className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div>
        <label htmlFor="department" className={labelClass}>
          Department
        </label>
        <input
          id="department"
          name="department"
          required
          list="departments"
          className={fieldClass}
        />
        <datalist id="departments">
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="contactNo" className={labelClass}>
          Contact number
        </label>
        <input
          id="contactNo"
          name="contactNo"
          type="tel"
          inputMode="tel"
          placeholder="09XX XXX XXXX"
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      {state.error && <Notice>{state.error}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

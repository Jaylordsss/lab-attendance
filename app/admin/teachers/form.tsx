"use client";

import { useActionState } from "react";
import { createTeacher, type TeacherState } from "./actions";
import { DEPARTMENTS } from "@/lib/auth";
import {
  fieldClass,
  labelClass,
  buttonClass,
  selectClass,
  selectChevron,
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
          <option value="" disabled>Choose department</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
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

      <div>
        <label htmlFor="contactNo" className={labelClass}>
          Mobile number
        </label>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-[#5A6B7A] shrink-0">+63</span>
          <input
            id="contactNo"
            name="contactNo"
            type="tel"
            inputMode="numeric"
            placeholder="917 123 4567"
            className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
          />
        </div>
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          Philippine mobile only. 0917… and +63 917… both work.
        </p>
      </div>

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

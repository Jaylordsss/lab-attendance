"use client";

import { useActionState } from "react";
import { createFirstAdmin, type SetupState } from "./actions";

const initial: SetupState = { error: null };

const field =
  "w-full border-b-2 border-[#16202B] bg-transparent pb-1.5 outline-none focus:border-[#0B6E5F]";
const label =
  "block text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-2";

export default function SetupForm() {
  const [state, formAction, pending] = useActionState(createFirstAdmin, initial);

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-[#FBFAF7] text-[#16202B]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(#E2E8ED 1px, transparent 1px), linear-gradient(90deg, #E2E8ED 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            One-time setup
          </p>
          <h1 className="mt-1 text-2xl font-medium leading-tight">
            Create the administrator
          </h1>
          <p className="mt-3 text-sm text-[#5A6B7A] leading-relaxed">
            This page closes for good once the account exists. Everyone else is
            added from the admin dashboard.
          </p>
        </header>

        <form
          action={formAction}
          className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
        >
          <div>
            <label htmlFor="setupKey" className={label}>
              Setup key
            </label>
            <input
              id="setupKey"
              name="setupKey"
              type="password"
              required
              autoComplete="off"
              className={`${field} font-mono`}
            />
            <p className="mt-2 text-xs text-[#5A6B7A]">
              The SETUP_KEY value from your server environment.
            </p>
          </div>

          <div>
            <label htmlFor="fullName" className={label}>
              Full name
            </label>
            <input id="fullName" name="fullName" type="text" required className={field} />
          </div>

          <div>
            <label htmlFor="email" className={label}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={field}
            />
          </div>

          <div>
            <label htmlFor="password" className={label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className={field}
            />
            <p className="mt-2 text-xs text-[#5A6B7A]">At least 12 characters.</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className={label}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className={field}
            />
          </div>

          {state.error && (
            <p
              role="alert"
              className="text-sm text-[#A8321F] border-l-2 border-[#A8321F] pl-3"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#16202B] text-white rounded py-3 text-sm tracking-wide transition-colors hover:bg-[#0B6E5F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E5F] disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create administrator"}
          </button>
        </form>
      </div>
    </main>
  );
}

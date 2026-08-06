"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type LoginState } from "./actions";
import PasswordInput from "@/components/password-input";

const initial: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initial);

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
            General Science Laboratory
          </p>
          <h1 className="mt-1 text-2xl font-medium leading-tight">Attendance</h1>
        </header>

        <form
          action={formAction}
          className="bg-white border border-[#D8DFE5] rounded-lg p-6 shadow-[0_1px_2px_rgba(22,32,43,0.04)]"
        >
          <div className="mb-5">
            <label
              htmlFor="identifier"
              className="block text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-2"
            >
              ID number
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="2024-00123"
              className="w-full font-mono text-lg tracking-[0.08em] border-b-2 border-[#16202B] bg-transparent pb-1.5 outline-none placeholder:text-[#B4BFC8] placeholder:tracking-normal focus:border-[#0B6E5F]"
            />
            <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
              Students use their student number, teachers and admins their
              faculty ID. An email address works too.
            </p>
          </div>

          <div className="mb-6">
            <PasswordInput
              id="password"
              label="Password"
              autoComplete="current-password"
            />
          </div>

          {state.error && (
            <p
              role="alert"
              className="mb-5 text-sm text-[#A8321F] border-l-2 border-[#A8321F] pl-3"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#16202B] text-white rounded py-3 text-sm tracking-wide transition-colors hover:bg-[#0B6E5F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E5F] disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-xs text-[#5A6B7A] leading-relaxed">
          <Link
            href="/forgot-password"
            className="underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            Forgotten your password?
          </Link>{" "}
          If your account has no email address yet, ask your teacher instead.
        </p>
      </div>
    </main>
  );
}

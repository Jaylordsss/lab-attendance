"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { BoxField, BoxPasswordField } from "@/components/box-field";

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

        <form action={formAction} className="space-y-4">
          <BoxField
            id="identifier"
            label="ID number"
            required
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="2024-00123"
            className="font-mono text-lg tracking-[0.06em]"
            hint="Students use their student number, teachers and admins their faculty ID. An email address works too."
          />

          <BoxPasswordField
            id="password"
            label="Password"
            required
            autoComplete="current-password"
            className="text-lg"
          />

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
            className="w-full rounded-lg bg-[#16202B] py-3.5 text-sm tracking-wide text-white transition-colors hover:bg-[#0B6E5F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E5F] disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            Forgotten your password?
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-[#5A6B7A] leading-relaxed">
          If your account has no email address yet, ask your teacher instead.
        </p>
      </div>
    </main>
  );
}

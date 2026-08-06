"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { setNewPassword, type ResetState } from "./actions";
import { createClient } from "@/lib/supabase/client";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: ResetState = { error: null };

export default function ResetForm() {
  const [state, formAction, pending] = useActionState(setNewPassword, initial);
  const [ready, setReady] = useState<"checking" | "ok" | "expired">("checking");
  const [name, setName] = useState("");

  useEffect(() => {
    const supabase = createClient();

    // The link carries its session in the URL fragment. The SDK reads it and
    // fires PASSWORD_RECOVERY, which is the only reliable signal that the
    // link was valid.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setName(session?.user.email ?? "");
        setReady("ok");
      }
    });

    // A link that is expired or already used leaves no session behind.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setName(data.session.user.email ?? "");
        setReady("ok");
      } else {
        setTimeout(
          () => setReady((r) => (r === "checking" ? "expired" : r)),
          1500,
        );
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (ready === "checking") {
    return (
      <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
        <p className="text-sm text-[#5A6B7A]">Checking your link…</p>
      </div>
    );
  }

  if (ready === "expired") {
    return (
      <div className="bg-white border-2 border-[#A8321F] rounded-lg p-6 space-y-4">
        <p className="text-sm font-medium" style={{ color: "#A8321F" }}>
          That link has expired
        </p>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Reset links can only be used once, and they don&rsquo;t last long.
          Ask for a new one.
        </p>
        <Link
          href="/forgot-password"
          className={`${buttonClass} inline-block text-center w-full`}
        >
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      {name && (
        <p className="text-sm text-[#5A6B7A]">
          Setting a new password for <span className="font-mono">{name}</span>
        </p>
      )}

      <div>
        <label htmlFor="password" className={labelClass}>New password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoFocus
          autoComplete="new-password"
          className={fieldClass}
        />
        <p className="mt-2 text-xs text-[#5A6B7A]">At least 8 characters.</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className={labelClass}>Confirm</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClass}
        />
      </div>

      {state.error && <Notice>{state.error}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Set password and sign in"}
      </button>
    </form>
  );
}

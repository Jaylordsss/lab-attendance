"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "@/components/admin-ui";

/**
 * A password field with a show/hide toggle.
 *
 * People mistype passwords constantly on phone keyboards, and a masked field
 * gives them no way to find out until the form rejects them. Being able to
 * look is worth more than hiding characters from a room that is usually
 * empty.
 */
export default function PasswordInput({
  id,
  name,
  label,
  hint,
  required = true,
  minLength,
  autoComplete = "current-password",
  autoFocus,
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="flex items-baseline gap-2">
        <input
          id={id}
          name={name ?? id}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`${fieldClass} ${visible ? "font-mono" : ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="shrink-0 text-[#5A6B7A] hover:text-[#0B6E5F] transition-colors pb-1.5"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint && <p className="mt-2 text-xs text-[#5A6B7A]">{hint}</p>}
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M8.2 5.2A7.6 7.6 0 0 1 10 5c5.5 0 8.5 5 8.5 5a15 15 0 0 1-2.4 2.9M5 6.3A14.6 14.6 0 0 0 1.5 10S4.5 15 10 15c1 0 1.9-.16 2.7-.43"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

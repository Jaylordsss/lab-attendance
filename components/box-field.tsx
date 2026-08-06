"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * A bordered field with its label inside the box.
 *
 * The label sits above the value rather than beside or below it, so it stays
 * visible while typing — a placeholder-only field forgets what it was asking
 * for the moment someone starts filling it in, which is exactly when a person
 * looks up to check.
 */
export function BoxField({
  id,
  label,
  hint,
  className,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="rounded-lg border border-[#C7D0D8] bg-white px-4 pt-2.5 pb-2 transition-colors focus-within:border-[#16202B]">
        <label
          htmlFor={id}
          className="block text-xs text-[#5A6B7A] mb-0.5"
        >
          {label}
        </label>
        <input
          id={id}
          name={props.name ?? id}
          className={`w-full bg-transparent outline-none placeholder:text-[#B4BFC8] ${className ?? ""}`}
          {...props}
        />
      </div>
      {hint && (
        <p className="mt-2 px-1 text-xs text-[#5A6B7A] leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The same box with a reveal control tucked inside it.
 *
 * Inside rather than alongside, because a button sitting outside the border
 * reads as belonging to the form, not to the field — people miss it.
 */
export function BoxPasswordField({
  id,
  label,
  hint,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="relative rounded-lg border border-[#C7D0D8] bg-white px-4 pt-2.5 pb-2 transition-colors focus-within:border-[#16202B]">
        <label htmlFor={id} className="block text-xs text-[#5A6B7A] mb-0.5">
          {label}
        </label>

        <input
          id={id}
          name={props.name ?? id}
          type={visible ? "text" : "password"}
          className={`w-full bg-transparent outline-none pr-10 placeholder:text-[#B4BFC8] ${
            visible ? "font-mono" : ""
          }`}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#5A6B7A] hover:text-[#16202B] transition-colors"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint && (
        <p className="mt-2 px-1 text-xs text-[#5A6B7A] leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

function Eye() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M8.2 5.2A7.6 7.6 0 0 1 10 5c5.5 0 8.5 5 8.5 5a15 15 0 0 1-2.4 2.9M5 6.3A14.6 14.6 0 0 0 1.5 10S4.5 15 10 15c1 0 1.9-.16 2.7-.43"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 3.5l13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

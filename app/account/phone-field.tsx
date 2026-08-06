"use client";

import { useState } from "react";
import { PH_MOBILE_DIGITS } from "@/lib/auth";
import { fieldClass, labelClass } from "@/components/admin-ui";

/**
 * A Philippine mobile input with a fixed +63 prefix.
 *
 * The prefix is shown, not typed, so the field holds exactly the ten
 * subscriber digits. A leading zero is stripped as you type — people reach for
 * "0917" out of habit, and silently accepting it would produce "+63 0917…",
 * which is eleven digits and not a real number.
 */
export default function PhoneField({
  id,
  name,
  label,
  defaultValue = "",
  hint,
  onComplete,
  onChangeValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  /** Fires with true once ten digits are present, false whenever they are not. */
  onComplete?: (complete: boolean) => void;
  /** Fires with the current digits, for forms tracking unsaved changes. */
  onChangeValue?: (digits: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);

  function onChange(raw: string) {
    let digits = raw.replace(/\D/g, "");
    // "0917…" and "63917…" are both common; keep only the subscriber part.
    if (digits.startsWith("63")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = digits.slice(1);

    const next = digits.slice(0, PH_MOBILE_DIGITS);
    setValue(next);
    onComplete?.(next.length === PH_MOBILE_DIGITS);
    onChangeValue?.(next);
  }

  const short = value.length > 0 && value.length < PH_MOBILE_DIGITS;

  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm text-[#5A6B7A] shrink-0">+63</span>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={PH_MOBILE_DIGITS}
          placeholder="9171234567"
          className={`${fieldClass} font-mono tracking-[0.05em] placeholder:tracking-normal placeholder:text-[#B4BFC8]`}
        />
        <span className="font-mono text-xs text-[#B4BFC8] shrink-0 tabular-nums">
          {value.length}/{PH_MOBILE_DIGITS}
        </span>
      </div>
      {short ? (
        <p className="mt-2 text-xs text-[#A8321F]">
          {PH_MOBILE_DIGITS - value.length} more{" "}
          {PH_MOBILE_DIGITS - value.length === 1 ? "digit" : "digits"} needed.
        </p>
      ) : (
        hint && <p className="mt-2 text-xs text-[#5A6B7A]">{hint}</p>
      )}
    </div>
  );
}

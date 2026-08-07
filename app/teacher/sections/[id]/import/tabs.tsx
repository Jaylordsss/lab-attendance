"use client";

import { useState } from "react";
import ImportForm from "./form";
import NumberForm from "./number-form";

/**
 * Two ways in, because there are two situations.
 *
 * Most of the time a teacher is adding students the school has already
 * registered, and the only fact needed is which class they are in. Pasting a
 * column of numbers should not require the full roster with guardian details
 * attached.
 */
export default function ImportTabs({ sectionId }: { sectionId: string }) {
  const [mode, setMode] = useState<"numbers" | "full">("numbers");

  const tab = (value: typeof mode, label: string, sub: string) => {
    const active = mode === value;
    return (
      <button
        key={value}
        onClick={() => setMode(value)}
        aria-pressed={active}
        className="flex-1 rounded-lg border-2 p-4 text-left transition-colors"
        style={{
          borderColor: active ? "#0B6E5F" : "#D8DFE5",
          backgroundColor: active ? "#F2F8F6" : "#FFFFFF",
        }}
      >
        <span
          className="block text-sm font-medium"
          style={{ color: active ? "#0B6E5F" : "#16202B" }}
        >
          {label}
        </span>
        <span className="mt-1 block text-xs text-[#5A6B7A] leading-relaxed">
          {sub}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        {tab(
          "numbers",
          "Student numbers only",
          "They already have accounts. Paste a list of numbers.",
        )}
        {tab(
          "full",
          "Full roster",
          "New students. Needs every detail in a spreadsheet.",
        )}
      </div>

      {mode === "numbers" ? (
        <NumberForm sectionId={sectionId} />
      ) : (
        <ImportForm sectionId={sectionId} />
      )}
    </div>
  );
}

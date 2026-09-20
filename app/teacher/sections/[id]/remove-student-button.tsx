"use client";

import { useState } from "react";
import { removeStudent } from "./actions";

export default function RemoveStudentButton({
  sectionId,
  studentId,
  studentName,
}: {
  sectionId: string;
  studentId: string;
  studentName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
      >
        Remove
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-[#A8321F]">Remove {studentName}?</span>
      <form action={removeStudent} className="contents">
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="studentId" value={studentId} />
        <button
          type="submit"
          className="font-medium text-[#A8321F] underline underline-offset-4 hover:opacity-70"
        >
          Yes
        </button>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[#5A6B7A] underline underline-offset-4 hover:opacity-70"
      >
        No
      </button>
    </span>
  );
}

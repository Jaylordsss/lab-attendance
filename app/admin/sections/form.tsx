"use client";

import { useActionState } from "react";
import { createSection, type SectionState } from "./actions";
import { DAY_NAMES } from "./days";
import {
  fieldClass,
  labelClass,
  buttonClass,
  selectClass,
  selectChevron,
  Notice,
} from "@/components/admin-ui";

const initial: SectionState = { error: null, success: null };

type Subject = { id: string; code: string; title: string };
type Room = { id: string; code: string; name: string };
type Teacher = { user_id: string; full_name: string; department: string };

export default function SectionForm({
  subjects,
  rooms,
  teachers,
}: {
  subjects: Subject[];
  rooms: Room[];
  teachers: Teacher[];
}) {
  const [state, formAction, pending] = useActionState(createSection, initial);

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-sm font-medium">Add a section</h2>

      <div>
        <label htmlFor="name" className={labelClass}>Section name</label>
        <input
          id="name"
          name="name"
          required
          placeholder="BSPT-3A"
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div>
        <label htmlFor="subjectId" className={labelClass}>Subject</label>
        <select
          id="subjectId"
          name="subjectId"
          required
          defaultValue=""
          className={selectClass}
          style={selectChevron}
        >
          <option value="" disabled>Choose subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="teacherId" className={labelClass}>Teacher</label>
        <select
          id="teacherId"
          name="teacherId"
          required
          defaultValue=""
          className={selectClass}
          style={selectChevron}
        >
          <option value="" disabled>Choose teacher</option>
          {teachers.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="roomId" className={labelClass}>Laboratory</label>
        <select
          id="roomId"
          name="roomId"
          required
          defaultValue=""
          className={selectClass}
          style={selectChevron}
        >
          <option value="" disabled>Choose laboratory</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="dayOfWeek" className={labelClass}>Day</label>
        <select
          id="dayOfWeek"
          name="dayOfWeek"
          required
          defaultValue="1"
          className={selectClass}
          style={selectChevron}
        >
          {DAY_NAMES.map((d, i) => (
            <option key={d} value={i}>{d}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startTime" className={labelClass}>Starts</label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            className={`${fieldClass} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="endTime" className={labelClass}>Ends</label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            className={`${fieldClass} font-mono`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="grace" className={labelClass}>Grace period (min)</label>
        <select
          id="grace"
          name="grace"
          defaultValue="15"
          className={selectClass}
          style={selectChevron}
        >
          {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "No grace period" : `${m} minutes`}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-[#5A6B7A]">
          Scans after this are marked late.
        </p>
      </div>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Add section"}
      </button>
    </form>
  );
}

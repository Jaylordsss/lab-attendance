"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { updateSection, deleteSection, type SectionState } from "../actions";
import { DAY_NAMES } from "../days";
import {
  fieldClass,
  labelClass,
  buttonClass,
  selectClass,
  selectChevron,
  Notice,
} from "@/components/admin-ui";

const initial: SectionState = { error: null, success: null };

type Option = { id: string; code?: string; title?: string; name?: string };
type Teacher = { user_id: string; full_name: string };

export type SectionValues = {
  id: string;
  name: string;
  subject_id: string;
  teacher_id: string;
  default_room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  grace_minutes: number;
};

export default function EditSectionForm({
  section,
  subjects,
  rooms,
  teachers,
}: {
  section: SectionValues;
  subjects: Option[];
  rooms: Option[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [save, saveAction, saving] = useActionState(updateSection, initial);
  const [remove, removeAction, removing] = useActionState(
    deleteSection,
    initial,
  );
  const [confirming, setConfirming] = useState(false);

  const hhmm = (t: string) => t.slice(0, 5);

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={section.id} />
        <h2 className="text-sm font-medium">Edit section</h2>

        <div>
          <label htmlFor="name" className={labelClass}>Section name</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={section.name}
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="subjectId" className={labelClass}>Subject</label>
          <select
            id="subjectId"
            name="subjectId"
            required
            defaultValue={section.subject_id}
            className={selectClass}
            style={selectChevron}
          >
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
            defaultValue={section.teacher_id}
            className={selectClass}
            style={selectChevron}
          >
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
            defaultValue={section.default_room_id ?? ""}
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
            defaultValue={String(section.day_of_week)}
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
              defaultValue={hhmm(section.start_time)}
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
              defaultValue={hhmm(section.end_time)}
              className={`${fieldClass} font-mono`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="grace" className={labelClass}>Grace period (min)</label>
          <select
            id="grace"
            name="grace"
            defaultValue={String(section.grace_minutes)}
            className={selectClass}
            style={selectChevron}
          >
            {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "No grace period" : `${m} minutes`}
              </option>
            ))}
          </select>
        </div>

        {save.error && <Notice>{save.error}</Notice>}
        {save.success && <Notice kind="success">{save.success}</Notice>}

        <button
          type="submit"
          disabled={saving}
          className={`${buttonClass} w-full`}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="border-t border-[#E2E8ED] pt-6">
        {confirming ? (
          <form action={removeAction} className="space-y-3">
            <input type="hidden" name="id" value={section.id} />
            <input type="hidden" name="name" value={section.name} />
            <p className="text-sm font-medium">Delete {section.name}?</p>
            <p className="text-sm text-[#5A6B7A] leading-relaxed">
              Its enrolments go with it. Only possible if the section has never
              held a class.
            </p>
            {remove.error && <Notice>{remove.error}</Notice>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={removing}
                onClick={() =>
                  setTimeout(() => router.push("/admin/sections"), 600)
                }
                className="rounded bg-[#A8321F] py-2 px-4 text-xs text-white disabled:opacity-50"
              >
                {removing ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-[#5A6B7A] underline underline-offset-4"
              >
                No, cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
          >
            Delete this section
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { createRoom, type RoomState } from "./actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: RoomState = { error: null, success: null };

export default function RoomForm() {
  const [state, formAction, pending] = useActionState(createRoom, initial);

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-sm font-medium">Add a laboratory</h2>

      <div>
        <label htmlFor="code" className={labelClass}>
          Code
        </label>
        <input
          id="code"
          name="code"
          required
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="LAB2"
          className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Chemistry Laboratory"
          className={`${fieldClass} placeholder:text-[#B4BFC8]`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="lat" className={labelClass}>
            Latitude
          </label>
          <input
            id="lat"
            name="lat"
            inputMode="decimal"
            placeholder="15.4869"
            className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
          />
        </div>
        <div>
          <label htmlFor="lng" className={labelClass}>
            Longitude
          </label>
          <input
            id="lng"
            name="lng"
            inputMode="decimal"
            placeholder="120.9675"
            className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="geofence" className={labelClass}>
          Geofence radius (m)
        </label>
        <input
          id="geofence"
          name="geofence"
          type="number"
          min={10}
          max={500}
          defaultValue={60}
          className={`${fieldClass} font-mono`}
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="allowStatic"
          className="mt-1 accent-[#0B6E5F]"
        />
        <span>
          Allow a printed QR at the door
          <span className="block text-xs text-[#5A6B7A] mt-1">
            Lower assurance. Requires coordinates and a GPS check on every scan.
          </span>
        </span>
      </label>

      {state.error && <Notice>{state.error}</Notice>}
      {state.success && <Notice kind="success">{state.success}</Notice>}

      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Saving…" : "Add laboratory"}
      </button>

      <p className="text-xs text-[#5A6B7A] leading-relaxed">
        Coordinates are optional unless you enable the printed QR. Stand in the
        room and check your phone's map app to read them off.
      </p>
    </form>
  );
}

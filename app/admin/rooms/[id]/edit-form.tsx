"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateRoom,
  deleteRoom,
  rotateSecret,
  type RoomState,
} from "../actions";
import {
  fieldClass,
  labelClass,
  buttonClass,
  Notice,
} from "@/components/admin-ui";

const initial: RoomState = { error: null, success: null };

export type Room = {
  id: string;
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  geofence_m: number;
  allow_static_qr: boolean;
};

export default function EditRoomForm({ room }: { room: Room }) {
  const router = useRouter();
  const [save, saveAction, saving] = useActionState(updateRoom, initial);
  const [rotate, rotateAction, rotating] = useActionState(rotateSecret, initial);
  const [remove, removeAction, removing] = useActionState(deleteRoom, initial);
  const [confirming, setConfirming] = useState<"none" | "rotate" | "delete">(
    "none",
  );

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={room.id} />
        <h2 className="text-sm font-medium">Edit laboratory</h2>

        <div>
          <label htmlFor="code" className={labelClass}>Code</label>
          <input
            id="code"
            name="code"
            required
            defaultValue={room.code}
            autoCapitalize="characters"
            spellCheck={false}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={room.name}
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="lat" className={labelClass}>Latitude</label>
            <input
              id="lat"
              name="lat"
              inputMode="decimal"
              defaultValue={room.lat ?? ""}
              placeholder="17.64576"
              className={`${fieldClass} font-mono placeholder:text-[#B4BFC8]`}
            />
          </div>
          <div>
            <label htmlFor="lng" className={labelClass}>Longitude</label>
            <input
              id="lng"
              name="lng"
              inputMode="decimal"
              defaultValue={room.lng ?? ""}
              placeholder="121.75967"
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
            defaultValue={room.geofence_m}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="allowStatic"
            defaultChecked={room.allow_static_qr}
            className="mt-1 accent-[#0B6E5F]"
          />
          <span>
            Allow a printed QR at the door
            <span className="block text-xs text-[#5A6B7A] mt-1">
              Requires coordinates and a GPS check on every scan.
            </span>
          </span>
        </label>

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

      <div className="border-t border-[#E2E8ED] pt-6 space-y-4">
        {confirming === "rotate" ? (
          <form action={rotateAction} className="space-y-3">
            <input type="hidden" name="id" value={room.id} />
            <p className="text-sm font-medium">Generate a new code?</p>
            <p className="text-sm text-[#5A6B7A] leading-relaxed">
              Every printed sheet for {room.code} stops working immediately.
              You'll need to print and replace it.
            </p>
            {rotate.error && <Notice>{rotate.error}</Notice>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={rotating}
                className="rounded bg-[#A8321F] py-2 px-4 text-xs text-white disabled:opacity-50"
              >
                {rotating ? "Generating…" : "Yes, replace it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming("none")}
                className="text-xs text-[#5A6B7A] underline underline-offset-4"
              >
                No, cancel
              </button>
            </div>
          </form>
        ) : confirming === "delete" ? (
          <form action={removeAction} className="space-y-3">
            <input type="hidden" name="id" value={room.id} />
            <input type="hidden" name="code" value={room.code} />
            <p className="text-sm font-medium">Delete {room.code}?</p>
            <p className="text-sm text-[#5A6B7A] leading-relaxed">
              Only possible if it has never held a class and no section uses it.
            </p>
            {remove.error && <Notice>{remove.error}</Notice>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={removing}
                onClick={() => setTimeout(() => router.push("/admin/rooms"), 600)}
                className="rounded bg-[#A8321F] py-2 px-4 text-xs text-white disabled:opacity-50"
              >
                {removing ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming("none")}
                className="text-xs text-[#5A6B7A] underline underline-offset-4"
              >
                No, cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-start gap-2">
            {rotate.success && (
              <Notice kind="success">{rotate.success}</Notice>
            )}
            <button
              onClick={() => setConfirming("rotate")}
              className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
            >
              Generate a new code
            </button>
            <button
              onClick={() => setConfirming("delete")}
              className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
            >
              Delete this laboratory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

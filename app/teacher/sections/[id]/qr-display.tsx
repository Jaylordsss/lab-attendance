"use client";

import { useState } from "react";

/**
 * The laboratory code, shown on the teacher's screen.
 *
 * The code itself is permanent and identical to the printed sheet — it names
 * the room and nothing else. What makes a scan count is the open session
 * behind it, so displaying it here is no less safe than taping it to the door.
 */
export default function QrDisplay({
  dataUrl,
  roomCode,
  roomName,
}: {
  dataUrl: string;
  roomCode: string;
  roomName: string;
}) {
  const [full, setFull] = useState(false);

  if (full) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#5A6B7A]">
          General Science Laboratory
        </p>
        <p className="mt-2 font-mono text-4xl tracking-[0.08em]">{roomCode}</p>
        <p className="text-lg">{roomName}</p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt={`Attendance code for ${roomName}`}
          className="mt-6 w-full max-w-[min(70vh,520px)]"
        />

        <p className="mt-6 text-sm text-[#5A6B7A]">Sign in first, then scan.</p>

        <button
          onClick={() => setFull(false)}
          className="mt-8 border border-[#16202B] rounded py-2.5 px-6 text-sm hover:bg-[#16202B] hover:text-white transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-[#D3E3DE] flex items-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`Attendance code for ${roomName}`}
        className="w-28 h-28 shrink-0"
      />
      <div className="text-sm">
        <p className="font-medium">Laboratory code</p>
        <p className="mt-1 text-[#5A6B7A] leading-relaxed">
          Students scan this or the printed copy on the door.
        </p>
        <button
          onClick={() => setFull(true)}
          className="mt-2 underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          Show full screen
        </button>
      </div>
    </div>
  );
}

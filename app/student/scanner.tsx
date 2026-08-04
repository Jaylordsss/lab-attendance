"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { createClient } from "@/lib/supabase/client";

/**
 * The student scan screen.
 *
 * Location and camera are both mandatory. Location is checked first: a phone
 * with GPS switched off cannot prove it is in the laboratory, so there is no
 * point opening the camera.
 */

type Phase = "checking" | "needLocation" | "needCamera" | "scanning" | "sending" | "done";

type Result = {
  ok: boolean;
  status?: "present" | "late";
  reason?: string;
  isBirthday?: boolean;
};

const REASONS: Record<string, string> = {
  invalid_code: "That code isn't recognised.",
  code_expired: "That code has expired. Scan the one on the wall.",
  no_open_session: "No class is open in this laboratory right now.",
  not_enrolled: "You're not enrolled in the class running here.",
  already_marked: "You're already marked in for this class.",
  out_of_range: "You're too far from the laboratory.",
  device_mismatch: "This account is registered to a different phone.",
  device_not_bound: "Ask your teacher to register your phone first.",
  unauthenticated: "Your session expired. Sign in again.",
  server_error: "Something went wrong. Try again.",
};

/** One account, one device. Persisted so the same phone is recognised. */
function deviceId(): string {
  const KEY = "lab-device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    // Speech is a nicety. Never let it break the scan.
  }
}

export default function Scanner({
  firstName,
  presetToken,
}: {
  firstName: string;
  presetToken?: string;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const sentRef = useRef(false);

  // ---- location, first and mandatory --------------------------------
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPhase("needLocation");
      setError("This phone can't report its location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPhase(presetToken ? "sending" : "needCamera");
      },
      () => {
        setPhase("needLocation");
        setError(null);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, [presetToken]);

  // ---- submit -------------------------------------------------------
  const submit = useCallback(
    async (token: string) => {
      if (sentRef.current || !coords) return;
      sentRef.current = true;
      setPhase("sending");
      controlsRef.current?.stop();

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch("/api/attendance/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            token,
            deviceId: deviceId(),
            lat: coords.lat,
            lng: coords.lng,
          }),
        });

        const data = (await res.json()) as Result;
        setResult(data);
        setPhase("done");

        if (data.ok) {
          if (data.isBirthday) {
            speak(`Happy birthday, ${firstName}! Maligayang kaarawan!`);
          } else if (data.status === "late") {
            speak("You are late.");
          }
        }
      } catch {
        setResult({ ok: false, reason: "server_error" });
        setPhase("done");
      }
    },
    [coords, firstName],
  );

  // A code arrived by deep link — no camera needed.
  useEffect(() => {
    if (presetToken && coords && !sentRef.current) submit(presetToken);
  }, [presetToken, coords, submit]);

  // ---- camera -------------------------------------------------------
  async function startCamera() {
    setError(null);
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (res) => {
          if (res) submit(res.getText());
        },
      );
      controlsRef.current = controls;
      setPhase("scanning");
    } catch {
      setError("Couldn't open the camera. Check the permission and try again.");
    }
  }

  useEffect(() => () => controlsRef.current?.stop(), []);

  // ---- screens ------------------------------------------------------

  if (phase === "needLocation") {
    return (
      <Panel title="Turn on location">
        <p>
          Attendance needs to confirm you're actually in the laboratory, so
          location has to be switched on. Allow it and reload this page.
        </p>
        {error && <p className="text-[#A8321F]">{error}</p>}
        <button onClick={() => window.location.reload()} className={btn}>
          I've turned it on
        </button>
      </Panel>
    );
  }

  if (phase === "done" && result) {
    if (!result.ok) {
      return (
        <Panel title="Not recorded" tone="#A8321F">
          <p>{REASONS[result.reason ?? ""] ?? "That scan didn't work."}</p>
          <button onClick={() => window.location.reload()} className={btn}>
            Try again
          </button>
        </Panel>
      );
    }

    const late = result.status === "late";
    return (
      <Panel
        title={late ? "You are late" : "You're in"}
        tone={late ? "#A8321F" : "#0B6E5F"}
      >
        {result.isBirthday && (
          <p className="text-2xl font-medium" style={{ color: "#0B6E5F" }}>
            Happy birthday, {firstName}!
          </p>
        )}
        <p>
          Marked {late ? "late" : "present"} at{" "}
          {new Date().toLocaleTimeString("en-PH", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
          })}
          . Show this to your teacher if they ask.
        </p>
      </Panel>
    );
  }

  if (phase === "checking" || phase === "sending") {
    return (
      <Panel title={phase === "sending" ? "Checking you in…" : "Finding you…"}>
        <p>One moment.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {phase !== "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={startCamera} className={btn}>
              Open camera
            </button>
          </div>
        )}
        {phase === "scanning" && (
          <div
            aria-hidden
            className="absolute inset-[18%] border-2 border-white/70 rounded-lg"
          />
        )}
      </div>

      <p className="text-sm text-[#5A6B7A] leading-relaxed">
        {phase === "scanning"
          ? "Point at the code on the laboratory door."
          : "Allow the camera to scan the laboratory code."}
      </p>

      {error && <p className="text-sm text-[#A8321F]">{error}</p>}
    </div>
  );
}

const btn =
  "bg-[#16202B] text-white rounded py-3 px-6 text-sm tracking-wide hover:bg-[#0B6E5F] transition-colors";

function Panel({
  title,
  tone = "#16202B",
  children,
}: {
  title: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border-2 bg-white p-8 space-y-4 text-sm leading-relaxed"
      style={{ borderColor: tone }}
    >
      <h2 className="text-xl font-medium" style={{ color: tone }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

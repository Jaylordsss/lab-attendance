"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the service worker and offers installation.
 *
 * The browser fires beforeinstallprompt when it decides the app qualifies; we
 * hold that event and surface our own button instead, because the native mini
 * bar is easy to miss and gives no reason to tap it.
 *
 * iOS never fires it — Safari requires Share, then Add to Home Screen — so
 * iPhone users get instructions rather than a button that would do nothing.
 */
export default function Pwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker costs offline resilience, nothing else.
      });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS reports installation here rather than through display-mode.
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    if (standalone) return;

    if (sessionStorage.getItem("install-dismissed") === "1") {
      setDismissed(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) setShowIosHelp(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    setDismissed(true);
    setPrompt(null);
    setShowIosHelp(false);
    sessionStorage.setItem("install-dismissed", "1");
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    close();
  }

  if (dismissed || (!prompt && !showIosHelp)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4">
      <div className="mx-auto max-w-md rounded-lg border-2 border-[#16202B] bg-white p-4 shadow-[0_4px_16px_rgba(22,32,43,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Add to your home screen</p>
            <p className="mt-1 text-sm text-[#5A6B7A] leading-relaxed">
              {prompt
                ? "Opens straight to the scanner, with no address bar over the camera."
                : "Tap Share, then Add to Home Screen."}
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Not now"
            className="text-lg leading-none text-[#B4BFC8] hover:text-[#16202B] px-1"
          >
            ×
          </button>
        </div>

        {prompt && (
          <button
            onClick={install}
            className="mt-3 w-full rounded bg-[#16202B] py-2.5 text-sm text-white transition-colors hover:bg-[#0B6E5F]"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

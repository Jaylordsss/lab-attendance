"use client";

import { useEffect, useState } from "react";

/**
 * Opens a PDF in a panel before it is saved.
 *
 * Attendance reports are printed and filed, so a wrong date range or an empty
 * section is expensive to discover after the fact. Looking first costs a
 * second; reprinting does not.
 *
 * The same route serves both: `?preview=1` returns the file inline for the
 * viewer, without it the browser downloads. One generator, no chance of the
 * preview and the saved copy disagreeing.
 */
export default function PdfPreview({
  href,
  label = "Preview PDF",
  title,
  className,
}: {
  /** Report URL, without the preview flag. */
  href: string;
  label?: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes it, as with any modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const previewUrl = href.includes("?")
    ? `${href}&preview=1`
    : `${href}?preview=1`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "border border-[#16202B] rounded py-2.5 px-5 text-sm hover:bg-[#16202B] hover:text-white transition-colors"
        }
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 bg-[#16202B]/40 p-4 sm:p-8 flex flex-col"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-[#D8DFE5] px-5 py-3">
              <p className="text-sm font-medium truncate">{title}</p>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={href}
                  className="rounded bg-[#16202B] py-2 px-4 text-sm text-white transition-colors hover:bg-[#0B6E5F]"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close preview"
                  className="text-xl leading-none text-[#5A6B7A] hover:text-[#16202B] px-1"
                >
                  ×
                </button>
              </div>
            </div>

            <iframe
              src={previewUrl}
              title={title}
              className="flex-1 w-full bg-[#F0F3F5]"
            />

            <p className="border-t border-[#D8DFE5] px-5 py-2 text-xs text-[#5A6B7A]">
              If the preview does not load, your browser may block embedded
              PDFs — download it instead.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

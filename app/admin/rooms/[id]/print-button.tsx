"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-[#16202B] text-white rounded py-2.5 px-5 text-sm tracking-wide transition-colors hover:bg-[#0B6E5F]"
    >
      Print this sheet
    </button>
  );
}

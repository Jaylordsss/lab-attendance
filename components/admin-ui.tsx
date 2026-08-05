import type { ReactNode } from "react";

export const fieldClass =
  "w-full border-b-2 border-[#16202B] bg-transparent pb-1.5 outline-none focus:border-[#0B6E5F]";
export const labelClass =
  "block text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-2";
export const buttonClass =
  "bg-[#16202B] text-white rounded py-2.5 px-5 text-sm tracking-wide transition-colors hover:bg-[#0B6E5F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E5F] disabled:opacity-50";

/**
 * Dropdowns get a box and a chevron rather than the underline used for text
 * inputs. An underlined select reads as an already filled-in field, so people
 * do not realise there is anything to open.
 */
export const selectClass =
  "w-full appearance-none rounded border border-[#D8DFE5] bg-white py-2 pl-3 pr-9 text-sm outline-none focus:border-[#0B6E5F] bg-no-repeat";

/** Chevron, as an inline style so no Tailwind arbitrary-URL escaping is needed. */
export const selectChevron = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='M3 4.5L6 7.5L9 4.5' stroke='%235A6B7A' stroke-width='1.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
  backgroundSize: "12px 12px",
  backgroundPosition: "right 0.75rem center",
} as const;

export const inputBoxClass =
  "w-full rounded border border-[#D8DFE5] bg-white py-2 px-3 text-sm outline-none focus:border-[#0B6E5F]";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-2xl font-medium leading-tight">{title}</h1>
      {children && (
        <p className="mt-2 text-sm text-[#5A6B7A] leading-relaxed max-w-prose">
          {children}
        </p>
      )}
    </header>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-[#5A6B7A] border border-dashed border-[#D8DFE5] rounded-lg p-6">
      {children}
    </p>
  );
}

export function Notice({
  kind = "error",
  children,
}: {
  kind?: "error" | "success";
  children: ReactNode;
}) {
  const color = kind === "error" ? "#A8321F" : "#0B6E5F";
  return (
    <p
      role="alert"
      className="text-sm pl-3 border-l-2"
      style={{ color, borderColor: color }}
    >
      {children}
    </p>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A] font-normal pb-2 pr-4">
      {children}
    </th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 pr-4 align-top">{children}</td>;
}

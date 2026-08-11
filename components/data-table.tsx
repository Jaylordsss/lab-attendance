import type { ReactNode } from "react";

export type Column = {
  /** Column heading, also used as the label on a phone. */
  head: string;
};

export type Row = {
  key: string;
  /** Cells, in the same order as the columns. */
  cells: ReactNode[];
};

/**
 * A table on a wide screen, a list of cards on a phone.
 *
 * Horizontal scrolling was the earlier answer and it does not work: a column
 * you cannot see is a column nobody reads, and on these pages the hidden ones
 * were the actions. Below the breakpoint each row becomes a card with its
 * heading beside each value, which needs no scrolling and leaves no doubt
 * about which column a number belonged to.
 *
 * One component renders both, so the two can never drift apart.
 */
export default function DataTable({
  columns,
  rows,
  caption,
  empty,
}: {
  columns: Column[];
  rows: Row[];
  caption?: string;
  empty?: string;
}) {
  if (rows.length === 0 && empty) {
    return (
      <p className="text-sm text-[#5A6B7A] border border-dashed border-[#D8DFE5] rounded-lg p-6">
        {empty}
      </p>
    );
  }

  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-5 sm:p-6">
      {/* Phone: one card per row, first cell as the title. */}
      <ul className="sm:hidden divide-y divide-[#F0F3F5]">
        {rows.map((row) => (
          <li key={row.key} className="py-4 first:pt-0 last:pb-0 space-y-2">
            <div className="font-medium">{row.cells[0]}</div>

            {row.cells.slice(1).map((cell, i) => {
              if (cell === null || cell === undefined || cell === "") {
                return null;
              }
              const head = columns[i + 1]?.head;
              return (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-4"
                >
                  {head && (
                    <span className="text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A] shrink-0">
                      {head}
                    </span>
                  )}
                  <div className="text-right min-w-0">{cell}</div>
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      {/* Tablet and up: a real table. */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b border-[#E2E8ED]">
            {columns.map((c, i) => (
              <th
                key={i}
                className="text-left text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A] font-normal pb-2 pr-4"
              >
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-[#F0F3F5]">
              {row.cells.map((cell, i) => (
                <td key={i} className="py-2.5 pr-4 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {caption && <p className="mt-4 text-xs text-[#5A6B7A]">{caption}</p>}
    </div>
  );
}

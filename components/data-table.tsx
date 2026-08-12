import type { ReactNode } from "react";

export type Column = { head: string };

export type Row = {
  key: string;
  cells: ReactNode[];
};

/**
 * A table wherever there is room for one, cards only on a narrow phone.
 *
 * The table is the better shape and worth keeping everywhere it fits: columns
 * line up down the page, so a figure can be read against the row above it at
 * a glance.
 *
 * It stops fitting somewhere below 640px, where a seven-column roster either
 * scrolls sideways — hiding the actions, which is what people then never find
 * — or squeezes each column until words break mid-syllable. Only below that
 * width are the same rows rendered as cards.
 *
 * One component renders both, so the two can never disagree.
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
      {/* Narrow phones only. */}
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
                <div key={i} className="flex items-baseline justify-between gap-4">
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

      {/* Everywhere else: the table, scrolling only if it truly must. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8ED]">
              {columns.map((c, i) => (
                <th
                  key={i}
                  className="text-left text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A] font-normal pb-2 pr-4 whitespace-nowrap"
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
      </div>

      {caption && <p className="mt-4 text-xs text-[#5A6B7A]">{caption}</p>}
    </div>
  );
}

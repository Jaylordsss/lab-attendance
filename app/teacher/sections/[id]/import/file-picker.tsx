"use client";

import { useRef, useState } from "react";

/**
 * File chooser for rosters.
 *
 * The native file input is styled differently by every browser and on some is
 * nearly invisible against a white card, so it is hidden behind a button that
 * matches the rest of the form.
 *
 * Excel files are converted to CSV here, in the browser, rather than uploaded
 * as binary. Schools export .xlsx far more often than .csv, and telling a
 * teacher to re-save the file first is the kind of instruction that ends with
 * them going back to typing names by hand.
 */
export default function FilePicker({
  onLoad,
  onError,
}: {
  onLoad: (csv: string, filename: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [reading, setReading] = useState(false);

  async function handle(file: File) {
    setReading(true);
    setFilename(file.name);

    try {
      const isExcel = /\.(xlsx|xlsm|xls)$/i.test(file.name);

      if (!isExcel) {
        onLoad(await file.text(), file.name);
        return;
      }

      // Loaded only when an Excel file is actually chosen, so the parser is
      // not shipped to every teacher who pastes a list instead.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });

      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        onError("That workbook has no sheets in it.");
        setFilename("");
        return;
      }

      // Dates come back as text in the sheet's own format rather than as
      // Excel serial numbers, which the importer can then read.
      onLoad(XLSX.utils.sheet_to_csv(sheet, { blankrows: false }), file.name);
    } catch {
      onError(
        "Couldn't read that file. Save it as CSV from Excel and try again.",
      );
      setFilename("");
    } finally {
      setReading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xlsm,.xls,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
        }}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading}
          className="rounded border border-[#16202B] bg-white py-2.5 px-5 text-sm transition-colors hover:bg-[#16202B] hover:text-white disabled:opacity-50"
        >
          {reading ? "Reading…" : "Choose a file"}
        </button>

        {filename && (
          <span className="text-sm text-[#5A6B7A] truncate">{filename}</span>
        )}
      </div>

      <p className="mt-2 text-xs text-[#5A6B7A]">
        Excel (.xlsx) or CSV. The first sheet is used.
      </p>
    </div>
  );
}

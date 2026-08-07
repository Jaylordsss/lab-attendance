"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  previewImport,
  confirmImport,
  type ImportState,
  type RowPlan,
} from "./actions";
import { buttonClass, Notice, Th, Td } from "@/components/admin-ui";
import FilePicker from "./file-picker";

const initial: ImportState = {
  error: null,
  plan: null,
  csv: null,
  created: null,
  summary: null,
};

const ACTION_COLOUR: Record<RowPlan["action"], string> = {
  create: "#0B6E5F",
  enrol: "#16202B",
  skip: "#5A6B7A",
  error: "#A8321F",
};

const ACTION_LABEL: Record<RowPlan["action"], string> = {
  create: "New account",
  enrol: "Enrol",
  skip: "Already in",
  error: "Cannot import",
};

const TEMPLATE = `student_no,full_name,email,birthdate,department,contact_no,address,guardian_name,guardian_phone
2024-00123,Maria Santos,maria.santos@gmail.com,2009-05-14,CITE,09171112222,"Caggay, Tuguegarao City",Arlene Santos,09171234567
2024-00124,Jose Cruz,jose.cruz@gmail.com,2009-11-02,CITE,09181113333,"Ugac Sur, Tuguegarao City",Rosa Cruz,09181234567`;

export default function ImportForm({ sectionId }: { sectionId: string }) {
  const [preview, previewAction, previewing] = useActionState(
    previewImport,
    initial,
  );
  const [confirm, confirmAction, confirming] = useActionState(
    confirmImport,
    initial,
  );

  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  /* ---- finished --------------------------------------------------- */
  if (confirm.summary) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-6">
          <h2 className="text-lg font-medium" style={{ color: "#0B6E5F" }}>
            Import finished
          </h2>
          <p className="mt-1 text-sm text-[#5A6B7A]">{confirm.summary}</p>
        </div>

        {confirm.created && (
          <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
            <h3 className="text-sm font-medium">Passwords for new accounts</h3>
            <p className="mt-1 text-sm text-[#5A6B7A] leading-relaxed">
              Print this page or copy it now — these cannot be shown again.
              Each student changes their password at first sign-in.
            </p>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8ED]">
                  <Th>Student number</Th>
                  <Th>Name</Th>
                  <Th>Password</Th>
                </tr>
              </thead>
              <tbody>
                {confirm.created.map((s) => (
                  <tr key={s.studentNo} className="border-b border-[#F0F3F5]">
                    <Td><span className="font-mono">{s.studentNo}</span></Td>
                    <Td>{s.fullName}</Td>
                    <Td><span className="font-mono">{s.password}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              type="button"
              onClick={() => window.print()}
              className="mt-5 border border-[#16202B] rounded py-2 px-4 text-sm hover:bg-[#16202B] hover:text-white transition-colors print:hidden"
            >
              Print this list
            </button>
          </div>
        )}

        <Link
          href={`/teacher/sections/${sectionId}`}
          className={`${buttonClass} inline-block w-full text-center print:hidden`}
        >
          Back to the section
        </Link>
      </div>
    );
  }

  /* ---- preview ----------------------------------------------------- */
  if (preview.plan) {
    const counts = preview.plan.reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {});

    const importable = (counts.create ?? 0) + (counts.enrol ?? 0);

    return (
      <div className="space-y-5">
        <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
          <h2 className="text-sm font-medium">What this will do</h2>
          <div className="mt-3 flex gap-6 flex-wrap">
            {(["create", "enrol", "skip", "error"] as const).map((a) =>
              counts[a] ? (
                <div key={a}>
                  <p
                    className="font-mono text-2xl leading-none"
                    style={{ color: ACTION_COLOUR[a] }}
                  >
                    {counts[a]}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
                    {ACTION_LABEL[a]}
                  </p>
                </div>
              ) : null,
            )}
          </div>

          <div className="mt-5 max-h-80 overflow-y-auto border-t border-[#E2E8ED] pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8ED]">
                  <Th>Line</Th>
                  <Th>Student number</Th>
                  <Th>Name</Th>
                  <Th>What happens</Th>
                </tr>
              </thead>
              <tbody>
                {preview.plan.map((r) => (
                  <tr key={r.line} className="border-b border-[#F0F3F5]">
                    <Td>
                      <span className="font-mono text-xs text-[#5A6B7A]">
                        {r.line}
                      </span>
                    </Td>
                    <Td><span className="font-mono">{r.studentNo}</span></Td>
                    <Td>{r.fullName}</Td>
                    <Td>
                      <span style={{ color: ACTION_COLOUR[r.action] }}>
                        {r.note}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {counts.error ? (
            <p className="mt-4 text-xs text-[#5A6B7A] leading-relaxed">
              Rows marked in red are skipped. Fix them in your file and import
              again — the ones that succeed now will simply be recognised.
            </p>
          ) : null}
        </div>

        <form action={confirmAction} className="flex gap-3 flex-wrap">
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="csv" value={preview.csv ?? ""} />
          <button
            type="submit"
            disabled={confirming || importable === 0}
            className={buttonClass}
          >
            {confirming
              ? "Importing…"
              : `Import ${importable} student${importable === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm text-[#5A6B7A] underline underline-offset-4"
          >
            Start again
          </button>
        </form>

        {confirm.error && <Notice>{confirm.error}</Notice>}
      </div>
    );
  }

  /* ---- upload ------------------------------------------------------ */
  return (
    <form
      action={previewAction}
      className="bg-white border border-[#D8DFE5] rounded-lg p-6 space-y-5"
    >
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="csv" value={csv} />

      <div>
        <p className="text-sm font-medium mb-2">Upload your class list</p>
        <FilePicker
          onLoad={(text) => {
            setFileError(null);
            setCsv(text);
          }}
          onError={setFileError}
        />
        {fileError && (
          <div className="mt-3">
            <Notice>{fileError}</Notice>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Or paste from a spreadsheet</p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={TEMPLATE}
          className="mt-2 w-full rounded border border-[#D8DFE5] p-3 font-mono text-xs outline-none focus:border-[#0B6E5F] placeholder:text-[#B4BFC8]"
        />
        <p className="mt-2 text-xs text-[#5A6B7A] leading-relaxed">
          Select your students in Google Sheets or Excel and paste. Include the
          header row if you can — without it the columns are read in the order
          shown below.
        </p>
      </div>

      {preview.error && <Notice>{preview.error}</Notice>}

      <button
        type="submit"
        disabled={previewing || !csv.trim()}
        className={`${buttonClass} w-full`}
      >
        {previewing ? "Reading…" : "Check the file"}
      </button>

      <div className="border-t border-[#E2E8ED] pt-5 text-xs text-[#5A6B7A] leading-relaxed space-y-2">
        <p className="font-medium text-[#16202B]">Columns</p>
        <p className="font-medium text-[#16202B]">Column order</p>
        <p className="font-mono text-[11px] leading-relaxed">
          student_no · full_name · email · birthdate · department · contact_no
          · address · guardian_name · guardian_phone
        </p>
        <p>
          Every column is needed for a new student:{" "}
          <span className="font-mono">student_no</span>,{" "}
          <span className="font-mono">full_name</span>,{" "}
          <span className="font-mono">email</span>,{" "}
          <span className="font-mono">birthdate</span>,{" "}
          <span className="font-mono">department</span>,{" "}
          <span className="font-mono">contact_no</span>,{" "}
          <span className="font-mono">address</span>,{" "}
          <span className="font-mono">guardian_name</span> and{" "}
          <span className="font-mono">guardian_phone</span>.
        </p>
        <p>
          The email is how a student recovers a forgotten password, the mobile
          is what the school rings in an emergency, and the department is what
          the headcounts are built from. A row missing any of them is listed as
          an error rather than imported half-filled.
        </p>
        <p>
          A student who already has an account is simply added to this section —
          only the number is used.
        </p>
        <p>
          Dates may be written 2009-05-14 or 14/05/2009. Mobile numbers may be
          written 09171234567 or +63 917 123 4567. Extra columns are ignored,
          so an existing school roster usually works unchanged.
        </p>
      </div>
    </form>
  );
}

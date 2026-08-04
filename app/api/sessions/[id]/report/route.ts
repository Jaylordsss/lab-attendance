import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/sessions/<id>/report
 *
 * One class session as a PDF: who was present, who was late, who was absent,
 * and every scan that was refused.
 *
 * The two database functions do their own permission checks — a teacher can
 * only pull their own sessions — so this route trusts them rather than
 * duplicating the rule.
 */

type Row = {
  kind: string;
  student_no: string;
  full_name: string;
  status: string;
  at: string | null;
  detail: string | null;
};

const INK = rgb(0.086, 0.125, 0.169);
const MUTED = rgb(0.353, 0.42, 0.478);
const RED = rgb(0.659, 0.196, 0.122);
const GREEN = rgb(0.043, 0.431, 0.373);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const supabase = await createClient();

  const [{ data: headerRows }, { data: reportRows }] = await Promise.all([
    supabase.rpc("session_header", { p_session_id: id }),
    supabase.rpc("session_report", { p_session_id: id }),
  ]);

  const header = (headerRows ?? [])[0];
  if (!header) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const rows = (reportRows ?? []) as Row[];
  const attendance = rows.filter((r) => r.kind === "attendance");
  const rejected = rows.filter((r) => r.kind === "rejected");

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let page = pdf.addPage([595, 842]); // A4
  const M = 48;
  let y = 842 - M;

  const text = (
    s: string,
    x: number,
    size = 10,
    font = regular,
    color = INK,
  ) => page.drawText(s, { x, y, size, font, color });

  const newPageIfNeeded = (needed = 24) => {
    if (y - needed < M) {
      page = pdf.addPage([595, 842]);
      y = 842 - M;
      return true;
    }
    return false;
  };

  // ---- header --------------------------------------------------------
  text("GENERAL SCIENCE LABORATORY", M, 8, bold, MUTED);
  y -= 18;
  text("Attendance record", M, 18, bold);
  y -= 26;

  text(
    `${header.subject_code} — ${header.subject_title}`,
    M,
    11,
    bold,
  );
  y -= 15;
  text(`Section ${header.section_name}`, M, 10, regular, MUTED);
  y -= 13;
  text(
    `${header.room_code} ${header.room_name} · ${header.teacher_name}`,
    M,
    10,
    regular,
    MUTED,
  );
  y -= 13;

  const dateLabel = new Date(header.session_date).toLocaleDateString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  text(
    `${dateLabel} · ${String(header.start_time).slice(0, 5)}–${String(header.end_time).slice(0, 5)} · ${header.grace_minutes} min grace`,
    M,
    10,
    regular,
    MUTED,
  );
  y -= 24;

  // ---- summary -------------------------------------------------------
  const present = attendance.filter((r) => r.status === "present").length;
  const late = attendance.filter((r) => r.status === "late").length;
  const absent = attendance.filter((r) => r.status === "absent").length;

  const tiles: [string, number, typeof INK][] = [
    ["Present", present, GREEN],
    ["Late", late, RED],
    ["Absent", absent, MUTED],
    ["Refused scans", rejected.length, MUTED],
  ];

  tiles.forEach(([label, value, color], i) => {
    const x = M + i * 128;
    page.drawText(String(value), {
      x,
      y,
      size: 22,
      font: mono,
      color,
    });
    page.drawText(label.toUpperCase(), {
      x,
      y: y - 13,
      size: 7,
      font: bold,
      color: MUTED,
    });
  });
  y -= 44;

  page.drawLine({
    start: { x: M, y },
    end: { x: 595 - M, y },
    thickness: 0.75,
    color: rgb(0.86, 0.89, 0.91),
  });
  y -= 22;

  // ---- attendance table ----------------------------------------------
  text("ATTENDANCE", M, 8, bold, MUTED);
  y -= 16;

  const cols = { no: M, name: M + 110, status: M + 320, time: M + 420 };
  const headerRow = () => {
    text("STUDENT NO", cols.no, 7, bold, MUTED);
    text("NAME", cols.name, 7, bold, MUTED);
    text("STATUS", cols.status, 7, bold, MUTED);
    text("TIME IN", cols.time, 7, bold, MUTED);
    y -= 14;
  };
  headerRow();

  const timeOf = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  for (const row of attendance) {
    if (newPageIfNeeded(20)) headerRow();

    const color =
      row.status === "late" ? RED : row.status === "absent" ? MUTED : INK;

    page.drawText(row.student_no, { x: cols.no, y, size: 9, font: mono, color });
    page.drawText(row.full_name.slice(0, 34), {
      x: cols.name,
      y,
      size: 9,
      font: regular,
      color,
    });
    page.drawText(row.status.toUpperCase(), {
      x: cols.status,
      y,
      size: 9,
      font: row.status === "late" ? bold : regular,
      color,
    });
    page.drawText(timeOf(row.at), {
      x: cols.time,
      y,
      size: 9,
      font: mono,
      color,
    });
    y -= 15;
  }

  // ---- rejected scans -------------------------------------------------
  if (rejected.length > 0) {
    y -= 16;
    newPageIfNeeded(60);
    text("REFUSED SCANS", M, 8, bold, MUTED);
    y -= 12;
    text(
      "Attempts that did not become attendance.",
      M,
      8,
      regular,
      MUTED,
    );
    y -= 16;

    text("STUDENT NO", cols.no, 7, bold, MUTED);
    text("NAME", cols.name, 7, bold, MUTED);
    text("REASON", cols.status, 7, bold, MUTED);
    text("TIME", cols.time, 7, bold, MUTED);
    y -= 14;

    for (const row of rejected) {
      if (newPageIfNeeded(20)) y -= 0;
      page.drawText(row.student_no, { x: cols.no, y, size: 9, font: mono, color: MUTED });
      page.drawText(row.full_name.slice(0, 34), {
        x: cols.name,
        y,
        size: 9,
        font: regular,
        color: MUTED,
      });
      page.drawText(row.status.replace(/_/g, " ").slice(0, 22), {
        x: cols.status,
        y,
        size: 9,
        font: regular,
        color: RED,
      });
      page.drawText(timeOf(row.at), { x: cols.time, y, size: 9, font: mono, color: MUTED });
      y -= 15;
    }
  }

  // ---- footer ---------------------------------------------------------
  const generated = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
  page.drawText(`Generated ${generated} by ${user.fullName}`, {
    x: M,
    y: 28,
    size: 7,
    font: regular,
    color: MUTED,
  });

  const bytes = await pdf.save();
  const filename = `attendance-${header.section_name.replace(/\s+/g, "-")}-${header.session_date}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

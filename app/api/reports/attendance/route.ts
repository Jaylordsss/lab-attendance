import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { rpcArgs, DAY_NAMES, type LogFilters } from "@/lib/report-filters";

export const runtime = "nodejs";

/**
 * GET /api/reports/attendance?from=&to=&room=&subject=&teacher=&section=&day=&status=
 *
 * Exports exactly the view the admin is looking at. The same filters go to the
 * same database function, so the PDF can never disagree with the screen.
 */

type Row = {
  session_date: string;
  student_no: string;
  full_name: string;
  status: string;
  scanned_at: string | null;
  section_name: string;
  subject_code: string;
  room_code: string;
  teacher_name: string;
  start_time: string;
  day_of_week: number;
};

const INK = rgb(0.086, 0.125, 0.169);
const MUTED = rgb(0.353, 0.42, 0.478);
const RED = rgb(0.659, 0.196, 0.122);
const GREEN = rgb(0.043, 0.431, 0.373);
const RULE = rgb(0.86, 0.89, 0.91);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorised" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const filters: LogFilters = {
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    room: sp.get("room") ?? undefined,
    subject: sp.get("subject") ?? undefined,
    teacher: sp.get("teacher") ?? undefined,
    section: sp.get("section") ?? undefined,
    day: sp.get("day") ?? undefined,
    status: sp.get("status") ?? undefined,
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attendance_log", rpcArgs(filters));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  // Landscape: nine columns do not fit comfortably on portrait A4.
  let page = pdf.addPage([842, 595]);
  const M = 40;
  let y = 595 - M;

  const draw = (
    s: string,
    x: number,
    size = 9,
    font = regular,
    color = INK,
  ) => page.drawText(s, { x, y, size, font, color });

  // ---- header --------------------------------------------------------
  draw("GENERAL SCIENCE LABORATORY", M, 8, bold, MUTED);
  y -= 18;
  draw("Attendance log", M, 17, bold);
  y -= 22;

  const range =
    filters.from && filters.to
      ? `${filters.from} to ${filters.to}`
      : filters.from
        ? `From ${filters.from}`
        : filters.to
          ? `Up to ${filters.to}`
          : "All dates";
  draw(range, M, 10, regular, MUTED);
  y -= 14;

  // Only mention filters actually in use, so the header stays readable.
  const applied: string[] = [];
  if (rows.length > 0) {
    if (filters.room) applied.push(`Laboratory ${rows[0].room_code}`);
    if (filters.subject) applied.push(`Subject ${rows[0].subject_code}`);
    if (filters.teacher) applied.push(`Teacher ${rows[0].teacher_name}`);
    if (filters.section) applied.push(`Section ${rows[0].section_name}`);
  }
  if (filters.day) applied.push(DAY_NAMES[Number(filters.day)]);
  if (filters.status) applied.push(`Status ${filters.status}`);

  if (applied.length > 0) {
    draw(applied.join(" · "), M, 9, regular, MUTED);
    y -= 14;
  }
  y -= 8;

  // ---- summary -------------------------------------------------------
  const present = rows.filter((r) => r.status === "present").length;
  const late = rows.filter((r) => r.status === "late").length;
  const absent = rows.filter((r) => r.status === "absent").length;

  ([
    ["Present", present, GREEN],
    ["Late", late, RED],
    ["Absent", absent, MUTED],
    ["Records", rows.length, INK],
  ] as [string, number, typeof INK][]).forEach(([label, value, color], i) => {
    const x = M + i * 110;
    page.drawText(String(value), { x, y, size: 20, font: mono, color });
    page.drawText(label.toUpperCase(), {
      x, y: y - 12, size: 7, font: bold, color: MUTED,
    });
  });
  y -= 40;

  page.drawLine({
    start: { x: M, y }, end: { x: 842 - M, y },
    thickness: 0.75, color: RULE,
  });
  y -= 18;

  // ---- table ---------------------------------------------------------
  const col = {
    date: M, student: M + 78, name: M + 158,
    section: M + 330, subject: M + 452,
    room: M + 534, teacher: M + 592, status: M + 700, time: M + 758,
  };

  const headerRow = () => {
    draw("DATE", col.date, 7, bold, MUTED);
    draw("STUDENT NO", col.student, 7, bold, MUTED);
    draw("NAME", col.name, 7, bold, MUTED);
    draw("SECTION", col.section, 7, bold, MUTED);
    draw("SUBJECT", col.subject, 7, bold, MUTED);
    draw("LAB", col.room, 7, bold, MUTED);
    draw("TEACHER", col.teacher, 7, bold, MUTED);
    draw("STATUS", col.status, 7, bold, MUTED);
    draw("TIME IN", col.time, 7, bold, MUTED);
    y -= 13;
  };
  headerRow();

  const clip = (s: string, n: number) =>
    s.length > n ? s.slice(0, n - 1) + "…" : s;

  for (const r of rows) {
    if (y - 16 < M + 20) {
      page = pdf.addPage([842, 595]);
      y = 595 - M;
      headerRow();
    }

    const color =
      r.status === "late" ? RED : r.status === "absent" ? MUTED : INK;

    page.drawText(r.session_date, { x: col.date, y, size: 8, font: mono, color });
    page.drawText(r.student_no, { x: col.student, y, size: 8, font: mono, color });
    page.drawText(clip(r.full_name, 27), { x: col.name, y, size: 8, font: regular, color });
    page.drawText(clip(r.section_name, 19), { x: col.section, y, size: 8, font: regular, color });
    page.drawText(clip(r.subject_code, 12), { x: col.subject, y, size: 8, font: regular, color });
    page.drawText(clip(r.room_code, 8), { x: col.room, y, size: 8, font: mono, color });
    page.drawText(clip(r.teacher_name, 17), { x: col.teacher, y, size: 8, font: regular, color });
    page.drawText(r.status.toUpperCase(), {
      x: col.status, y, size: 8,
      font: r.status === "late" ? bold : regular, color,
    });
    page.drawText(
      r.scanned_at
        ? new Date(r.scanned_at).toLocaleTimeString("en-PH", {
            timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
          })
        : "—",
      { x: col.time, y, size: 8, font: mono, color },
    );
    y -= 14;
  }

  if (rows.length === 0) {
    draw("No attendance matches these filters.", M, 10, regular, MUTED);
  }

  // ---- footer on every page -------------------------------------------
  const generated = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
  });
  pdf.getPages().forEach((p, i, all) => {
    p.drawText(
      `Generated ${generated} by ${user.fullName} · Page ${i + 1} of ${all.length}`,
      { x: M, y: 24, size: 7, font: regular, color: MUTED },
    );
  });

  const bytes = await pdf.save();
  const stamp = filters.from && filters.to
    ? `${filters.from}_${filters.to}`
    : new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="attendance-${stamp}.pdf"`,
    },
  });
}

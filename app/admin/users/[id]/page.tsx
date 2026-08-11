import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { piiKey } from "@/lib/require-teacher";
import { formatPhPhone } from "@/lib/auth";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

type Account = {
  full_name: string;
  role: string;
  identifier: string | null;
  department: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

type TeacherStats = {
  sections_taught: number;
  students_taught: number;
  classes_held: number;
  opened_late: number;
  left_open: number;
  avg_open_delay: number | null;
  present: number;
  late: number;
  absent: number;
  turnout: number | null;
};

type SectionRow = {
  section_name: string;
  subject_code: string;
  room_code: string;
  students: number;
  classes_held: number;
  turnout: number | null;
};

type StudentRow = {
  section_name: string;
  subject_code: string;
  present: number;
  late: number;
  absent: number;
  rate: number | null;
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  // account_summary checks is_admin(), which reads auth.uid() — so it must run
  // as the signed-in administrator, not the service role.
  const supabase = await createClient();

  const { data: accountRows, error } = await supabase.rpc("account_summary", {
    p_user_id: id,
  });

  if (error) console.error("account_summary:", error.message);

  const account = ((accountRows ?? []) as Account[])[0];
  if (!account) notFound();

  const isStudent = account.role === "student";

  return (
    <>
      <Link
        href="/admin/users"
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        All users
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow={`${account.role} · ${account.identifier ?? "no ID"}`}
          title={account.full_name}
        >
          {[account.department, account.email].filter(Boolean).join(" · ")}
          {account.status !== "active" && " · suspended"}
        </PageHeader>
      </div>

      {isStudent ? (
        <StudentView userId={id} name={account.full_name} />
      ) : (
        <TeacherView userId={id} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

async function TeacherView({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [statsRes, sectionsRes] = await Promise.all([
    supabase.rpc("teacher_analytics", { p_user_id: userId }),
    supabase.rpc("teacher_sections_summary", { p_user_id: userId }),
  ]);

  const stats = ((statsRes.data ?? []) as TeacherStats[])[0];
  const sections = (sectionsRes.data ?? []) as SectionRow[];

  if (!stats || Number(stats.sections_taught) === 0) {
    return <Empty>This teacher has no sections yet.</Empty>;
  }

  const punctual = Number(stats.classes_held) - Number(stats.opened_late);

  return (
    <div className="space-y-8">
      <Stats
        items={[
          { label: "Sections", value: stats.sections_taught },
          { label: "Students", value: stats.students_taught },
          { label: "Classes held", value: stats.classes_held },
          {
            label: "Opened on time",
            value: `${punctual}/${stats.classes_held}`,
            colour: Number(stats.opened_late) > 0 ? "#A8321F" : "#0B6E5F",
          },
          {
            label: "Turnout",
            value: stats.turnout === null ? "—" : `${stats.turnout}%`,
            colour:
              stats.turnout !== null && Number(stats.turnout) < 80
                ? "#A8321F"
                : "#0B6E5F",
          },
        ]}
      />

      {(Number(stats.left_open) > 0 || Number(stats.opened_late) > 0) && (
        <div className="rounded-lg border-2 border-[#E8C4BC] bg-[#FDF4F2] p-4 text-sm leading-relaxed">
          {Number(stats.opened_late) > 0 && (
            <p style={{ color: "#A8321F" }}>
              {stats.opened_late} class
              {Number(stats.opened_late) === 1 ? " was" : "es were"} opened
              after the grace period
              {stats.avg_open_delay !== null &&
                ` — ${stats.avg_open_delay} minutes after the bell on average`}
              .
            </p>
          )}
          {Number(stats.left_open) > 0 && (
            <p className="mt-1 text-[#5A6B7A]">
              {stats.left_open} session
              {Number(stats.left_open) === 1 ? "" : "s"} left open past the end
              of the day.
            </p>
          )}
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium mb-3">Their sections</h2>
        <Table
          head={["Section", "Students", "Classes", "Turnout"]}
          rows={sections.map((s) => [
            <>
              <span className="block">{s.section_name}</span>
              <span className="block font-mono text-xs text-[#5A6B7A]">
                {s.subject_code} · {s.room_code}
              </span>
            </>,
            <span className="font-mono">{s.students}</span>,
            <span className="font-mono">{s.classes_held}</span>,
            <span
              className="font-mono"
              style={{
                color:
                  s.turnout !== null && Number(s.turnout) < 80
                    ? "#A8321F"
                    : "#0B6E5F",
              }}
            >
              {s.turnout === null ? "—" : `${s.turnout}%`}
            </span>,
          ])}
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

async function StudentView({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const supabase = await createClient();
  const service = getServiceClient();

  const [summaryRes, recordRes] = await Promise.all([
    supabase.rpc("student_attendance_summary", { p_user_id: userId }),
    service.rpc("student_record", { p_user_id: userId, p_key: piiKey() }),
  ]);

  const summary = (summaryRes.data ?? []) as StudentRow[];
  const record = ((recordRes.data ?? []) as any[])[0];

  const totals = summary.reduce(
    (acc, s) => ({
      present: acc.present + Number(s.present),
      late: acc.late + Number(s.late),
      absent: acc.absent + Number(s.absent),
    }),
    { present: 0, late: 0, absent: 0 },
  );

  const marked = totals.present + totals.late + totals.absent;
  const rate = marked
    ? Math.round(((totals.present + totals.late) / marked) * 100)
    : null;

  return (
    <div className="space-y-8">
      <Stats
        items={[
          { label: "Present", value: totals.present, colour: "#0B6E5F" },
          { label: "Late", value: totals.late, colour: "#A8321F" },
          { label: "Absent", value: totals.absent, colour: "#5A6B7A" },
          {
            label: "Attendance",
            value: rate === null ? "—" : `${rate}%`,
            colour: rate !== null && rate < 80 ? "#A8321F" : "#0B6E5F",
          },
        ]}
      />

      <section>
        <h2 className="text-sm font-medium mb-3">By class</h2>
        {summary.length === 0 ? (
          <Empty>No attendance recorded yet.</Empty>
        ) : (
          <Table
            head={["Class", "Present", "Late", "Absent", "Rate"]}
            rows={summary.map((s) => [
              <>
                <span className="block">{s.section_name}</span>
                <span className="block font-mono text-xs text-[#5A6B7A]">
                  {s.subject_code}
                </span>
              </>,
              <span className="font-mono">{s.present}</span>,
              <span
                className="font-mono"
                style={{ color: Number(s.late) ? "#A8321F" : undefined }}
              >
                {s.late}
              </span>,
              <span className="font-mono text-[#5A6B7A]">{s.absent}</span>,
              <span
                className="font-mono"
                style={{
                  color:
                    s.rate !== null && Number(s.rate) < 80
                      ? "#A8321F"
                      : "#0B6E5F",
                }}
              >
                {s.rate === null ? "—" : `${s.rate}%`}
              </span>,
            ])}
          />
        )}
      </section>

      {record && (
        <Card>
          <h2 className="text-sm font-medium mb-4">Guardian and address</h2>
          <dl className="space-y-4 text-sm">
            <Field label="Guardian" value={record.guardian_name || "—"} />
            <Field
              label="Guardian mobile"
              value={
                record.guardian_phone
                  ? formatPhPhone(record.guardian_phone)
                  : "—"
              }
              tel={record.guardian_phone || undefined}
            />
            <Field
              label="Student mobile"
              value={record.contact_no ? formatPhPhone(record.contact_no) : "—"}
              tel={record.contact_no || undefined}
            />
            <Field label="Address" value={record.address || "—"} />
          </dl>
          <p className="mt-5 text-xs text-[#5A6B7A] leading-relaxed">
            Personal data of a minor under RA 10173. Opening this page is
            recorded in the audit log.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stats({
  items,
}: {
  items: { label: string; value: number | string; colour?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-[#D8DFE5] bg-white p-4"
        >
          <p
            className="font-mono text-2xl leading-none"
            style={{ color: s.colour }}
          >
            {s.value}
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="bg-white border border-[#D8DFE5] rounded-lg p-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E2E8ED]">
            {head.map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-[#F0F3F5]">
              {cells.map((c, j) => (
                <Td key={j}>{c}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  value,
  tel,
}: {
  label: string;
  value: string;
  tel?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A]">
        {label}
      </dt>
      <dd className="mt-1">
        {tel ? (
          <a href={`tel:${tel}`} className="font-mono underline underline-offset-4">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

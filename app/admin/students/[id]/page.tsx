import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { getServiceClient } from "@/lib/supabase/admin";
import { piiKey } from "@/lib/require-teacher";
import { formatPhPhone } from "@/lib/auth";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

type Record = {
  student_no: string;
  full_name: string;
  birthdate: string;
  department: string | null;
  contact_no: string | null;
  address: string;
  guardian_name: string;
  guardian_phone: string;
  device_bound_at: string | null;
  profile_complete: boolean;
  created_at: string;
};

type Summary = {
  section_name: string;
  subject_code: string;
  present: number;
  late: number;
  absent: number;
  rate: number | null;
};

export default async function StudentRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const service = getServiceClient();

  const [recordRes, summaryRes] = await Promise.all([
    service.rpc("student_record", { p_user_id: id, p_key: piiKey() }),
    service.rpc("student_attendance_summary", { p_user_id: id }),
  ]);

  const record = ((recordRes.data ?? []) as Record[])[0];
  if (!record) notFound();

  const summary = (summaryRes.data ?? []) as Summary[];

  const dob = new Date(record.birthdate).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Link
        href="/admin/users?role=student"
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        All students
      </Link>

      <div className="mt-4">
        <PageHeader eyebrow={record.student_no} title={record.full_name}>
          {record.department ?? "No department"} · born {dob}
        </PageHeader>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section className="space-y-8">
          <div>
            <h2 className="text-sm font-medium mb-3">Attendance</h2>
            {summary.length === 0 ? (
              <Empty>No attendance recorded yet.</Empty>
            ) : (
              <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8ED]">
                      <Th>Class</Th>
                      <Th>Present</Th>
                      <Th>Late</Th>
                      <Th>Absent</Th>
                      <Th>Rate</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, i) => {
                      const rate = row.rate ?? 0;
                      return (
                        <tr key={i} className="border-b border-[#F0F3F5]">
                          <Td>
                            <span className="block">{row.section_name}</span>
                            <span className="block font-mono text-xs text-[#5A6B7A]">
                              {row.subject_code}
                            </span>
                          </Td>
                          <Td><span className="font-mono">{row.present}</span></Td>
                          <Td>
                            <span
                              className="font-mono"
                              style={{ color: row.late > 0 ? "#A8321F" : undefined }}
                            >
                              {row.late}
                            </span>
                          </Td>
                          <Td>
                            <span className="font-mono text-[#5A6B7A]">
                              {row.absent}
                            </span>
                          </Td>
                          <Td>
                            <span
                              className="font-mono"
                              style={{ color: rate < 80 ? "#A8321F" : "#0B6E5F" }}
                            >
                              {rate}%
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-4 text-xs text-[#5A6B7A]">
                  Rate counts present and late as attended. Below 80% is shown
                  in red.
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-6">
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
                mono
                tel={record.guardian_phone || undefined}
              />
              <Field
                label="Student mobile"
                value={
                  record.contact_no ? formatPhPhone(record.contact_no) : "—"
                }
                mono
                tel={record.contact_no || undefined}
              />
              <Field label="Address" value={record.address || "—"} />
            </dl>
            <p className="mt-5 text-xs text-[#5A6B7A] leading-relaxed">
              Personal data of a minor under RA 10173. Opening this page is
              recorded in the audit log.
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-medium mb-4">Account</h2>
            <dl className="space-y-4 text-sm">
              <Field
                label="Profile"
                value={record.profile_complete ? "Complete" : "Incomplete"}
              />
              <Field
                label="Phone registered"
                value={
                  record.device_bound_at
                    ? new Date(record.device_bound_at).toLocaleDateString(
                        "en-PH",
                        { day: "numeric", month: "short", year: "numeric" },
                      )
                    : "Not yet"
                }
              />
            </dl>
            <Link
              href="/admin/users?role=student"
              className="mt-5 inline-block text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
            >
              Reset password or unbind phone
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  mono,
  tel,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tel?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A]">
        {label}
      </dt>
      <dd className={mono ? "font-mono mt-1" : "mt-1"}>
        {tel ? (
          <a href={`tel:${tel}`} className="underline underline-offset-4">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

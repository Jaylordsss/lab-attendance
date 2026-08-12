import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin-ui";
import DataTable from "@/components/data-table";
import Threshold from "./threshold";

export const dynamic = "force-dynamic";

type Row = {
  student_id: string;
  student_no: string;
  full_name: string;
  department: string | null;
  guardian_phone_set: boolean;
  classes_marked: number;
  attended: number;
  absent: number;
  rate: number;
};

export default async function AtRiskPage({
  searchParams,
}: {
  searchParams: Promise<{ threshold?: string; min?: string }>;
}) {
  const params = await searchParams;
  const threshold = Number(params.threshold ?? 80);
  const minClasses = Number(params.min ?? 3);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("at_risk_students", {
    p_threshold: Number.isFinite(threshold) ? threshold : 80,
    p_min_classes: Number.isFinite(minClasses) ? minClasses : 3,
  });

  if (error) console.error("at_risk_students:", error.message);

  const students = (data ?? []) as Row[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Students to watch">
        Below the attendance threshold across all their classes. Present and
        late both count as attended.
      </PageHeader>

      <Threshold threshold={threshold} minClasses={minClasses} />

      <div className="mt-6">
        <DataTable
          empty={`Nobody is below ${threshold}% after ${minClasses} or more classes.`}
          caption={
            students.length > 0
              ? `${students.length} student${students.length === 1 ? "" : "s"} below ${threshold}%`
              : undefined
          }
          columns={[
            { head: "Student" },
            { head: "Department" },
            { head: "Classes" },
            { head: "Attended" },
            { head: "Absent" },
            { head: "Rate" },
          ]}
          rows={students.map((s) => ({
            key: s.student_id,
            cells: [
              <div key="name">
                <Link
                  href={`/admin/users/${s.student_id}`}
                  className="underline underline-offset-4 hover:text-[#0B6E5F]"
                >
                  {s.full_name}
                </Link>
                <span className="block font-mono text-xs font-normal text-[#5A6B7A]">
                  {s.student_no}
                </span>
                {!s.guardian_phone_set && (
                  <span
                    className="block text-xs font-normal"
                    style={{ color: "#A8321F" }}
                  >
                    No guardian number on file
                  </span>
                )}
              </div>,
              <span key="dept" className="text-[#5A6B7A]">
                {s.department ?? "—"}
              </span>,
              <span key="marked" className="font-mono">
                {s.classes_marked}
              </span>,
              <span key="att" className="font-mono">
                {s.attended}
              </span>,
              <span key="abs" className="font-mono" style={{ color: "#A8321F" }}>
                {s.absent}
              </span>,
              <span
                key="rate"
                className="font-mono"
                style={{ color: Number(s.rate) < 60 ? "#A8321F" : "#16202B" }}
              >
                {s.rate}%
              </span>,
            ],
          }))}
        />
      </div>

      <p className="mt-6 text-xs text-[#5A6B7A] leading-relaxed max-w-prose">
        Students with fewer than {minClasses} recorded classes are left out —
        one absence in a student&rsquo;s first week says nothing yet, and
        listing them would bury the students who do need following up.
      </p>
    </>
  );
}

import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/require-teacher";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import { DAY_NAMES } from "@/app/admin/sections/days";
import { makeStaticToken, tokenUrl } from "@/lib/qr-token";
import { startWindow } from "@/lib/schedule";
import EnrolForm from "./form";
import SessionPanel from "./session-panel";
import MarkRow, { type RosterEntry } from "./mark-row";
import { removeStudent } from "./actions";

export const dynamic = "force-dynamic";

type RosterRow = {
  user_id: string;
  student_no: string;
  full_name: string;
  birthdate: string;
};

function manilaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("sections")
    .select("id, name, day_of_week, start_time, end_time, teacher_id, grace_minutes, default_room_id, subjects(code, title), rooms(code, name)")
    .eq("id", id)
    .maybeSingle();

  if (!section || (section as any).teacher_id !== teacher.id) notFound();

  const { data: rosterData } = await supabase.rpc("section_roster", {
    p_section_id: id,
  });
  const roster = (rosterData ?? []) as RosterRow[];

  const { data: deptData } = await supabase.rpc("department_list");
  const departments = (deptData ?? []) as {
    department: string;
    code: string;
  }[];

  const service = getServiceClient();

  const { data: session } = await service
    .from("class_sessions")
    .select("id, status")
    .eq("section_id", id)
    .eq("session_date", manilaToday())
    .maybeSingle();

  const isOpen = session?.status === "open";

  // The signing secret is read here, on the server, and used to mint the code.
  // Only the resulting image reaches the browser.
  let qrDataUrl: string | null = null;
  const roomId = (section as any).default_room_id as string | null;

  if (isOpen && roomId) {
    const { data: room } = await service
      .from("rooms")
      .select("id, qr_secret")
      .eq("id", roomId)
      .maybeSingle();

    if (room) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const token = makeStaticToken(room.id as string, room.qr_secret as string);
      qrDataUrl = await QRCode.toDataURL(tokenUrl(origin, token), {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 700,
        color: { dark: "#16202B", light: "#FFFFFF" },
      });
    }
  }

  let attendees: any[] = [];
  let rejections: any[] = [];
  let sessionRoster: RosterEntry[] = [];
  if (session) {
    const { data: sr, error: srErr } = await service.rpc("session_roster", {
      p_session_id: session.id,
    });
    if (srErr) console.error("session_roster:", srErr.message);
    sessionRoster = (sr ?? []) as RosterEntry[];

    const { data, error: attErr } = await service
      .from("attendance")
      .select("status, scanned_at, students(student_no, profiles(full_name))")
      .eq("class_session_id", session.id)
      .order("scanned_at", { ascending: false });

    if (attErr) console.error("attendance query:", attErr.message);

    attendees = (data ?? []).map((a: any) => ({
      status: a.status,
      scanned_at: a.scanned_at,
      student_no: a.students?.student_no ?? "",
      full_name: a.students?.profiles?.full_name ?? "",
    }));

    const { data: rej, error: rejErr } = await service
      .from("scan_rejections")
      .select("reason, at, distance_m, profiles(full_name, students(student_no))")
      .eq("class_session_id", session.id)
      .order("at", { ascending: false })
      .limit(20);

    if (rejErr) console.error("rejections query:", rejErr.message);

    rejections = (rej ?? []).map((r: any) => ({
      reason: r.reason,
      at: r.at,
      distance_m: r.distance_m ?? null,
      student_no: r.profiles?.students?.student_no ?? "—",
      full_name: r.profiles?.full_name ?? "Unknown",
    }));
  }

  const s = section as any;

  const window = startWindow({
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
  });

  return (
    <>
      <PageHeader
        eyebrow={`${s.subjects?.code} · ${DAY_NAMES[s.day_of_week]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`}
        title={s.name}
      >
        {s.subjects?.title} in {s.rooms?.name ?? "no laboratory assigned"}.
        Scans after {s.grace_minutes} minutes are marked late.
      </PageHeader>

      <div className="mb-8">
        <SessionPanel
          sectionId={id}
          sessionId={(session?.id as string) ?? null}
          isOpen={isOpen}
          roomCode={s.rooms?.code ?? null}
          roomName={s.rooms?.name ?? null}
          qrDataUrl={qrDataUrl}
          attendees={attendees}
          rejections={rejections}
          enrolledCount={roster.length}
          startWindow={window}
          scheduledDay={DAY_NAMES[s.day_of_week]}
        />
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-medium">Roster</h2>
            <span className="text-xs text-[#5A6B7A]">
              {roster.length} {roster.length === 1 ? "student" : "students"}
            </span>
          </div>

          {session && sessionRoster.length > 0 ? (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6">
              <ul className="divide-y divide-[#F0F3F5]">
                {sessionRoster.map((entry) => (
                  <li key={entry.student_id} className="py-3 first:pt-0 last:pb-0">
                    <MarkRow
                      sectionId={id}
                      sessionId={session.id as string}
                      entry={entry}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[#5A6B7A] leading-relaxed">
                Mark a student by hand when their phone cannot scan. Every
                manual mark needs a reason and is kept with the record.
              </p>
            </div>
          ) : roster.length === 0 ? (
            <Empty>Nobody enrolled yet. Add your first student.</Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Student number</Th>
                    <Th>Name</Th>
                    <Th>Birthday</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((student) => (
                    <tr key={student.user_id} className="border-b border-[#F0F3F5]">
                      <Td><span className="font-mono">{student.student_no}</span></Td>
                      <Td>{student.full_name}</Td>
                      <Td>
                        <span className="text-[#5A6B7A]">
                          {new Date(student.birthdate).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </Td>
                      <Td>
                        <form action={removeStudent}>
                          <input type="hidden" name="sectionId" value={id} />
                          <input type="hidden" name="studentId" value={student.user_id} />
                          <button
                            type="submit"
                            className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#A8321F]"
                          >
                            Remove
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card>
          <EnrolForm sectionId={id} departments={departments} />
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { PageHeader, Empty } from "@/components/admin-ui";
import { DAY_NAMES } from "@/app/admin/sections/days";
import NextClassBanner, { type NextClass } from "./next-class";

export const dynamic = "force-dynamic";

export default async function TeacherHome() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [sectionsRes, nextRes] = await Promise.all([
    supabase
      .from("sections")
      .select(
        "id, name, day_of_week, start_time, end_time, subjects(code, title), rooms(code)",
      )
      .order("day_of_week")
      .order("start_time"),
    supabase.rpc("my_next_class", { p_user_id: user!.id }),
  ]);

  const sections = (sectionsRes.data ?? []) as any[];
  const next = ((nextRes.data ?? []) as NextClass[])[0] ?? null;

  return (
    <>
      <PageHeader eyebrow="Teacher" title="Your sections">
        Open a section to see its roster and enrol students. Attendance
        sessions are started from inside a section.
      </PageHeader>

      {next && <NextClassBanner next={next} />}

      {sections.length === 0 ? (
        <Empty>
          You have no sections yet. Ask the administrator to assign you one.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {sections.map((s) => (
            <li key={s.id}>
              <Link
                href={`/teacher/sections/${s.id}`}
                className="block bg-white border border-[#D8DFE5] rounded-lg p-5 hover:border-[#0B6E5F] transition-colors"
              >
                {/*
                  Stacked on a phone, side by side from small tablets up.
                  Squeezing both columns onto a narrow screen pushed the day
                  and time into the middle of the card, where it read as
                  belonging to nothing.
                */}
                <div className="sm:flex sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-[#5A6B7A]">
                      {s.subjects?.code} — {s.subjects?.title}
                    </p>
                  </div>

                  <p className="mt-2 text-sm text-[#5A6B7A] sm:mt-0 sm:text-right sm:shrink-0">
                    <span className="sm:block">{DAY_NAMES[s.day_of_week]}</span>{" "}
                    <span className="font-mono text-xs">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} ·{" "}
                      {s.rooms?.code ?? "—"}
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

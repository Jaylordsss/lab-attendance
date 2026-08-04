import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import Scanner from "./scanner";

export const dynamic = "force-dynamic";

export default async function StudentPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: sections } = await supabase
    .from("sections")
    .select("name, start_time, end_time, subjects(code)")
    .order("day_of_week");

  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      <h1 className="text-2xl font-medium mb-1">Scan to check in</h1>
      <p className="text-sm text-[#5A6B7A] mb-6 leading-relaxed">
        Your location and camera are both needed — they prove you're in the
        laboratory.
      </p>

      <Scanner firstName={firstName} presetToken={t} />

      {sections && sections.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-[#5A6B7A] mb-3">
            Your classes
          </h2>
          <ul className="space-y-2 text-sm">
            {(sections as any[]).map((s, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{s.subjects?.code} — {s.name}</span>
                <span className="font-mono text-xs text-[#5A6B7A]">
                  {s.start_time.slice(0, 5)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

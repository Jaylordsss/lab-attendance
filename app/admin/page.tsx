import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin-ui";
import { dismissAlert, clearAlerts } from "./actions";

export const dynamic = "force-dynamic";

type Alert = {
  alert_key: string;
  kind: string;
  severity: number;
  title: string;
  detail: string;
  at: string;
};

/**
 * Counting a specific column rather than *, because column-level grants on
 * `rooms` keep qr_secret out of reach and a select * there is refused
 * outright rather than omitting it.
 *
 * The column differs per table: `staff` is keyed on user_id, not id. Teachers
 * are counted from `profiles` instead, so admins are not folded into the
 * total.
 */
const TILES = [
  { href: "/admin/rooms", label: "Laboratories", table: "rooms", column: "id" },
  { href: "/admin/subjects", label: "Subjects", table: "subjects", column: "id" },
  { href: "/admin/sections", label: "Sections", table: "sections", column: "id" },
  {
    href: "/admin/teachers",
    label: "Teachers",
    table: "profiles",
    column: "id",
    role: "teacher",
  },
] as const;

const ALERT_LINK: Record<string, string> = {
  out_of_range: "/admin/attendance",
  device_mismatch: "/admin/users?role=student",
  very_late: "/admin/attendance?status=late",
  not_started: "/admin/sections",
  left_open: "/admin/sections",
};

export default async function AdminHome() {
  const supabase = await createClient();

  const counts = await Promise.all(
    TILES.map(async (t) => {
      let query = supabase
        .from(t.table)
        .select(t.column, { count: "exact", head: true });

      if ("role" in t && t.role) query = query.eq("role", t.role);

      const { count, error } = await query;
      if (error) console.error(`count ${t.table}:`, error.message);
      return count ?? 0;
    }),
  );

  const { data, error } = await supabase.rpc("admin_alerts", { p_days: 1 });
  if (error) console.error("admin_alerts:", error.message);

  const alerts = (data ?? []) as Alert[];
  const urgent = alerts.filter((a) => a.severity >= 2);

  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview">
        Set up laboratories, subjects and teachers first. Sections tie them
        together, and students are enrolled into sections.
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TILES.map((tile, i) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="bg-white border border-[#D8DFE5] rounded-lg p-5 hover:border-[#0B6E5F] transition-colors"
          >
            <p className="font-mono text-3xl leading-none">{counts[i]}</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[#5A6B7A]">
              {tile.label}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <h2 className="text-sm font-medium">Needs your attention</h2>
          <div className="flex items-baseline gap-4">
            {urgent.length > 0 && (
              <span className="text-xs" style={{ color: "#A8321F" }}>
                {urgent.length} urgent
              </span>
            )}
            {alerts.length > 0 && (
              <form action={clearAlerts}>
                <button
                  type="submit"
                  className="text-xs text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
                >
                  Clear all
                </button>
              </form>
            )}
          </div>
        </div>

        {alerts.length === 0 ? (
          <p className="text-sm text-[#5A6B7A] border border-dashed border-[#D8DFE5] rounded-lg p-6">
            Nothing unusual today. Classes opened on time, and every scan came
            from inside a laboratory.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => {
              const isUrgent = a.severity >= 2;
              return (
                <li
                  key={a.alert_key}
                  className="rounded-lg border bg-white transition-colors hover:border-[#0B6E5F]"
                  style={{ borderColor: isUrgent ? "#E8C4BC" : "#D8DFE5" }}
                >
                  <div className="flex items-start gap-2 p-4">
                    <Link
                      href={ALERT_LINK[a.kind] ?? "/admin/attendance"}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p
                          className="text-sm font-medium"
                          style={{ color: isUrgent ? "#A8321F" : "#16202B" }}
                        >
                          {a.title}
                        </p>
                        <p className="font-mono text-xs text-[#5A6B7A] shrink-0">
                          {new Date(a.at).toLocaleTimeString("en-PH", {
                            timeZone: "Asia/Manila",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-[#5A6B7A]">{a.detail}</p>
                    </Link>

                    <form action={dismissAlert}>
                      <input type="hidden" name="alertKey" value={a.alert_key} />
                      <button
                        type="submit"
                        aria-label="Dismiss"
                        title="Dismiss"
                        className="text-[#B4BFC8] hover:text-[#A8321F] transition-colors px-1 leading-none text-lg"
                      >
                        ×
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs text-[#5A6B7A] leading-relaxed">
          Today only — the list starts fresh each morning. Covers scans from
          outside a laboratory, accounts used on another phone, arrivals more
          than 45 minutes late, classes never opened, and classes left open
          after they ended.
        </p>
      </section>
    </>
  );
}

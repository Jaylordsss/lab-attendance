import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

async function countOf(table: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

const TILES = [
  { href: "/admin/rooms", label: "Laboratories", table: "rooms" },
  { href: "/admin/subjects", label: "Subjects", table: "subjects" },
  { href: "/admin/sections", label: "Sections", table: "sections" },
  { href: "/admin/teachers", label: "Teachers", table: "staff" },
];

export default async function AdminHome() {
  const counts = await Promise.all(TILES.map((t) => countOf(t.table)));

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
    </>
  );
}

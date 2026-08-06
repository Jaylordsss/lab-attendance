import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireTeacher } from "@/lib/require-teacher";
import { PageHeader } from "@/components/admin-ui";
import ImportForm from "./form";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teacher = await requireTeacher();
  const supabase = await createClient();

  const { data: section } = await supabase
    .from("sections")
    .select("id, name, teacher_id, subjects(code)")
    .eq("id", id)
    .maybeSingle();

  if (!section || (section as any).teacher_id !== teacher.id) notFound();

  const s = section as any;

  return (
    <>
      <Link
        href={`/teacher/sections/${id}`}
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        Back to {s.name}
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow={`${s.subjects?.code} · ${s.name}`}
          title="Import a roster"
        >
          Paste your class list or choose a CSV file. Nothing is saved until
          you have seen what it will do.
        </PageHeader>
      </div>

      <div className="max-w-2xl">
        <ImportForm sectionId={id} />
      </div>
    </>
  );
}

import Link from "next/link";
import { requireTeacher } from "@/lib/require-teacher";
import { PageHeader } from "@/components/admin-ui";
import StudentSearch from "./search";

export const dynamic = "force-dynamic";

export default async function TeacherStudentsPage() {
  await requireTeacher();

  return (
    <>
      <Link
        href="/teacher"
        className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
      >
        Back to your sections
      </Link>

      <div className="mt-4">
        <PageHeader eyebrow="Teacher" title="Student help">
          For a student who has forgotten their password or is on a new phone.
          Search by student number — you can only find students in your own
          sections.
        </PageHeader>
      </div>

      <div className="max-w-md">
        <StudentSearch />
      </div>
    </>
  );
}

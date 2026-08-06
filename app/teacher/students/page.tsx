import { requireTeacher } from "@/lib/require-teacher";
import { PageHeader } from "@/components/admin-ui";
import StudentSearch from "./search";

export const dynamic = "force-dynamic";

export default async function TeacherStudentsPage() {
  await requireTeacher();

  return (
    <>
      <PageHeader eyebrow="Teacher" title="Student help">
        For a student who has forgotten their password or is on a new phone.
        Search by student number — you can only find students in your own
        sections.
      </PageHeader>

      <div className="max-w-md">
        <StudentSearch />
      </div>
    </>
  );
}

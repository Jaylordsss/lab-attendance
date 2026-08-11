import { requireAdmin } from "@/lib/require-admin";
import { signOut } from "@/app/login/actions";
import NavTabs from "@/components/nav-tabs";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/attendance", label: "Attendance" },
  { href: "/admin/rooms", label: "Laboratories" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/sections", label: "Sections" },
  { href: "/admin/users", label: "All users" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-dvh bg-[#FBFAF7] text-[#16202B]">
      {/*
        Two rows, and the name is not squeezed against Sign out. On a phone
        the single-row version wrapped the name under the status bar and split
        "Sign out" across lines.
      */}
      <div className="border-b border-[#D8DFE5] bg-white">
        <div className="mx-auto max-w-6xl px-6 pt-4 pb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
              General Science Laboratory
            </p>
            <p className="text-sm font-medium truncate">{user.fullName}</p>
          </div>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="text-sm text-[#5A6B7A] underline underline-offset-4 whitespace-nowrap hover:text-[#0B6E5F]"
            >
              Sign out
            </button>
          </form>
        </div>

        <NavTabs items={NAV} />
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

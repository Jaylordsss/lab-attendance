import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { signOut } from "@/app/login/actions";

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
      <div className="border-b border-[#D8DFE5] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
              General Science Laboratory
            </p>
            <p className="text-sm font-medium">{user.fullName}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
            >
              Sign out
            </button>
          </form>
        </div>

        <nav className="mx-auto max-w-6xl px-6">
          <ul className="flex gap-6 overflow-x-auto">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block py-3 text-sm whitespace-nowrap border-b-2 border-transparent hover:border-[#0B6E5F] hover:text-[#0B6E5F]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}

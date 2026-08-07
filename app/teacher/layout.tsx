import Link from "next/link";
import { requireTeacher } from "@/lib/require-teacher";
import { signOut } from "@/app/login/actions";

const linkClass =
  "text-sm text-[#5A6B7A] underline underline-offset-4 whitespace-nowrap hover:text-[#0B6E5F]";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireTeacher();

  return (
    <div className="min-h-dvh bg-[#FBFAF7] text-[#16202B]">
      <div className="border-b border-[#D8DFE5] bg-white">
        <div className="mx-auto max-w-4xl px-6 pt-4 pb-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            General Science Laboratory
          </p>
          <p className="text-sm font-medium">{user.fullName}</p>
        </div>

        <nav className="mx-auto max-w-4xl px-6 pb-3">
          <ul className="flex items-baseline gap-5 overflow-x-auto">
            <li>
              <Link href="/teacher" className={linkClass}>
                Sections
              </Link>
            </li>
            <li>
              <Link href="/teacher/students" className={linkClass}>
                Student help
              </Link>
            </li>
            <li>
              <Link href="/account" className={linkClass}>
                Account
              </Link>
            </li>
            <li className="ml-auto">
              <form action={signOut}>
                <button type="submit" className={linkClass}>
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </nav>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}

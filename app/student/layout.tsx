import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

const linkClass =
  "text-sm text-[#5A6B7A] underline underline-offset-4 whitespace-nowrap hover:text-[#0B6E5F]";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/");

  // A student with gaps in their record fills them before anything else.
  // Guardian contact is the reason: the school needs a number that works on
  // the day something goes wrong in a laboratory, and asking for it then is
  // too late.
  const supabase = await createClient();
  const { data: complete } = await supabase.rpc("student_profile_complete", {
    p_user_id: user.id,
  });

  if (complete === false) redirect("/account?complete=1");

  return (
    <div className="min-h-dvh bg-[#FBFAF7] text-[#16202B]">
      {/*
        Two rows rather than one. On a phone the name and three links do not
        fit side by side, and squeezing them wraps "Sign out" onto its own
        line mid-word — which reads as a layout fault rather than a header.
      */}
      <div className="border-b border-[#D8DFE5] bg-white">
        <div className="mx-auto max-w-md px-6 pt-4 pb-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            Attendance
          </p>
          <p className="text-sm font-medium">{user.fullName}</p>
        </div>

        <nav className="mx-auto max-w-md px-6 pb-3">
          <ul className="flex items-baseline gap-5 overflow-x-auto">
            <li>
              <Link href="/student" className={linkClass}>
                Scanner
              </Link>
            </li>
            <li>
              <Link href="/student/attendance" className={linkClass}>
                My attendance
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

      <main className="mx-auto max-w-md px-6 py-8">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { requireTeacher } from "@/lib/require-teacher";
import { signOut } from "@/app/login/actions";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireTeacher();

  return (
    <div className="min-h-dvh bg-[#FBFAF7] text-[#16202B]">
      <div className="border-b border-[#D8DFE5] bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-baseline justify-between gap-4">
          <Link href="/teacher">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
              General Science Laboratory
            </p>
            <p className="text-sm font-medium">{user.fullName}</p>
          </Link>
          <div className="flex items-baseline gap-5">
            <Link
              href="/account"
              className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
            >
              Account
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}

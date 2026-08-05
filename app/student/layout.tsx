import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/");

  return (
    <div className="min-h-dvh bg-[#FBFAF7] text-[#16202B]">
      <div className="border-b border-[#D8DFE5] bg-white">
        <div className="mx-auto max-w-md px-6 py-4 flex items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
              Attendance
            </p>
            <p className="text-sm font-medium">{user.fullName}</p>
          </div>
          <div className="flex items-baseline gap-4">
            <Link
              href="/account"
              className="text-sm text-[#5A6B7A] underline underline-offset-4"
            >
              Account
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-sm text-[#5A6B7A] underline underline-offset-4"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-md px-6 py-8">{children}</main>
    </div>
  );
}

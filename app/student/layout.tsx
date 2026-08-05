import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

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

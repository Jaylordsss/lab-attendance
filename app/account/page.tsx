import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { formatPhPhone, HOME_FOR_ROLE } from "@/lib/auth";
import PasswordForm from "./form";
import ContactForm from "./contact-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isStaff = user.role !== "student";

  let email = "";
  let contactNo = "";
  let facultyId = "";
  let department = "";

  if (isStaff) {
    const service = getServiceClient();

    const [{ data: authUser }, { data: staff }] = await Promise.all([
      service.auth.admin.getUserById(user.id),
      service
        .from("staff")
        .select("faculty_id, department, contact_no")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    email = authUser.user?.email ?? "";
    facultyId = (staff?.faculty_id as string) ?? "";
    department = (staff?.department as string) ?? "";
    contactNo = staff?.contact_no
      ? formatPhPhone(staff.contact_no as string)
      : "";
  }

  return (
    <main className="min-h-dvh bg-[#FBFAF7] text-[#16202B] p-6">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(#E2E8ED 1px, transparent 1px), linear-gradient(90deg, #E2E8ED 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative mx-auto max-w-sm py-8">
        <Link
          href={HOME_FOR_ROLE[user.role]}
          className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          Back to dashboard
        </Link>

        <header className="mt-4 mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            {user.fullName}
          </p>
          <h1 className="mt-1 text-2xl font-medium">Your account</h1>
          {isStaff && facultyId && (
            <p className="mt-2 text-sm text-[#5A6B7A]">
              <span className="font-mono">{facultyId}</span>
              {department && ` · ${department}`}
            </p>
          )}
        </header>

        <div className="space-y-8">
          {isStaff && (
            <ContactForm email={email} contactNo={contactNo} />
          )}
          <PasswordForm />
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { piiKey } from "@/lib/require-teacher";
import {
  toNationalDigits,
  isSyntheticStudentEmail,
  HOME_FOR_ROLE,
} from "@/lib/auth";
import PasswordForm from "./password-form";
import StaffContactForm from "./staff-contact-form";
import StudentProfileForm from "./student-profile-form";
import { SetupSteps, SetupDone } from "./setup-steps";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string; done?: string }>;
}) {
  const { complete, done } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const inSetup = complete === "1" && user.role === "student";

  const service = getServiceClient();
  const { data: authUser } = await service.auth.admin.getUserById(user.id);
  const rawEmail = authUser.user?.email ?? "";
  const email = isSyntheticStudentEmail(rawEmail) ? "" : rawEmail;

  // A code can only be sent to an inbox that exists.
  const canUseCode = Boolean(email) && Boolean(authUser.user?.email_confirmed_at);

  const { data: profile } = await service
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  const needsPassword = profile?.must_change_password === true;
  const firstName = user.fullName.split(" ")[0];

  let body = null;
  let subtitle = "";
  let profileComplete = true;

  if (user.role === "student") {
    const { data } = await service.rpc("my_student_profile", {
      p_user_id: user.id,
      p_key: piiKey(),
    });
    const p = (data ?? [])[0] ?? {};

    profileComplete = Boolean(
      p.contact_no && p.address && p.guardian_name && p.guardian_phone,
    );
    subtitle = p.student_no ?? "";

    body = (
      <StudentProfileForm
        inSetup={inSetup}
        email={email}
        contactNo={toNationalDigits(p.contact_no)}
        guardianName={p.guardian_name ?? ""}
        guardianNo={toNationalDigits(p.guardian_phone)}
        address={p.address ?? ""}
        studentNo={p.student_no ?? ""}
        birthdate={p.birthdate ?? ""}
        department={p.department ?? ""}
      />
    );
  } else {
    const { data: staff } = await service
      .from("staff")
      .select("faculty_id, department, contact_no")
      .eq("user_id", user.id)
      .maybeSingle();

    subtitle = [staff?.faculty_id, staff?.department].filter(Boolean).join(" · ");
    body = (
      <StaffContactForm
        email={email}
        contactNo={toNationalDigits(staff?.contact_no as string | null)}
      />
    );
  }

  // Which step of setup they are on: details, then password, then finished.
  const step: 1 | 2 | 3 = !profileComplete ? 1 : needsPassword ? 2 : 3;
  const finished = inSetup && step === 3;

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
        {!inSetup && (
          <Link
            href={HOME_FOR_ROLE[user.role]}
            className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            Back to dashboard
          </Link>
        )}

        <header className="mt-4 mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            {inSetup ? "Setting up" : "Your account"}
          </p>
          <h1 className="mt-1 text-2xl font-medium">{user.fullName}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[#5A6B7A] font-mono">{subtitle}</p>
          )}
        </header>

        {inSetup && <SetupSteps current={step} />}

        {finished || done === "1" ? (
          <SetupDone firstName={firstName} />
        ) : (
          <div className="space-y-8">
            {step === 1 && inSetup && (
              <>
                <Notice>
                  Your mobile number, address and guardian details are needed
                  before you can scan. The school has to be able to reach
                  someone if anything happens in the laboratory.
                </Notice>
                {body}
              </>
            )}

            {step === 2 && inSetup && (
              <>
                <Notice>
                  Your details are saved. Now choose a password only you know —
                  the one you were given was shared with your teacher.
                </Notice>
                <PasswordForm inSetup />
              </>
            )}

            {!inSetup && (
              <>
                {body}
                <PasswordForm canUseCode={canUseCode} />
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-4">
      <p className="text-sm text-[#5A6B7A] leading-relaxed">{children}</p>
    </div>
  );
}

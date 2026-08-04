import { adminExists } from "@/lib/supabase/admin";
import SetupForm from "./form";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await adminExists()) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6 bg-[#FBFAF7] text-[#16202B]">
        <div className="max-w-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            General Science Laboratory
          </p>
          <h1 className="mt-1 mb-3 text-2xl font-medium">Setup complete</h1>
          <p className="text-sm text-[#5A6B7A] leading-relaxed">
            An administrator account already exists, so this page is closed.
            Further accounts are created from the admin dashboard.
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 text-sm underline underline-offset-4 hover:text-[#0B6E5F]"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return <SetupForm />;
}

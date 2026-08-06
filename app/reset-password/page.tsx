import ResetForm from "./form";

export const metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

/**
 * Where the emailed reset link lands.
 *
 * Supabase puts the session in the URL fragment, which never reaches the
 * server, so this page cannot check who the visitor is. The client component
 * waits for the SDK to pick the fragment up before showing the form.
 */
export default function ResetPasswordPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-[#FBFAF7] text-[#16202B]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(#E2E8ED 1px, transparent 1px), linear-gradient(90deg, #E2E8ED 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            General Science Laboratory
          </p>
          <h1 className="mt-1 text-2xl font-medium">Set a new password</h1>
        </header>

        <ResetForm />
      </div>
    </main>
  );
}

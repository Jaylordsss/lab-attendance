import Link from "next/link";
import ForgotForm from "./form";

export const metadata = { title: "Forgotten password" };

export default function ForgotPasswordPage() {
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
          <h1 className="mt-1 text-2xl font-medium">Forgotten password</h1>
        </header>

        <ForgotForm />

        <Link
          href="/login"
          className="mt-5 inline-block text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

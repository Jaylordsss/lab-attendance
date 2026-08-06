import Link from "next/link";

/**
 * Progress through first-run setup.
 *
 * Shown only while a student is being held here. Three steps, because a
 * student who does not know how many are left assumes the worst and gives up
 * halfway.
 */
export function SetupSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Your details", "Your password", "Done"] as const;

  return (
    <ol className="mb-8 flex gap-2">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;

        return (
          <li key={label} className="flex-1">
            <div
              className="h-1 rounded-full"
              style={{
                backgroundColor: done || active ? "#0B6E5F" : "#E2E8ED",
              }}
            />
            <p
              className="mt-2 text-[11px] uppercase tracking-[0.12em]"
              style={{ color: active ? "#0B6E5F" : "#5A6B7A" }}
            >
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The last screen: nothing left to do but start using it. */
export function SetupDone({ firstName }: { firstName: string }) {
  return (
    <div className="rounded-lg border-2 border-[#0B6E5F] bg-[#F2F8F6] p-6">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#0B6E5F]">
        All set
      </p>
      <h2 className="mt-1 text-xl font-medium">
        You&rsquo;re ready, {firstName}
      </h2>
      <p className="mt-2 text-sm text-[#5A6B7A] leading-relaxed">
        When your class starts, open the scanner and point your camera at the
        code on the laboratory door. Your location has to be switched on.
      </p>
      <Link
        href="/student"
        className="mt-5 inline-block rounded bg-[#16202B] py-3 px-6 text-sm text-white transition-colors hover:bg-[#0B6E5F]"
      >
        Go to the scanner
      </Link>
    </div>
  );
}

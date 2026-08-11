/**
 * Placeholder shown while a page is still being rendered on the server.
 *
 * Every page here is dynamic — attendance is live, so nothing can be cached —
 * which means a tap costs a function start plus several round trips to the
 * database before any HTML comes back. On a phone that is a second or two of
 * a screen that has not changed, and a screen that has not changed reads as a
 * tap that did not register. People tap again, which makes it worse.
 *
 * The content arrives no sooner. It simply stops looking broken.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[#E2E8ED] ${className}`}
      aria-hidden
    />
  );
}

export function PageSkeleton({
  rows = 4,
  stats = 0,
}: {
  rows?: number;
  stats?: number;
}) {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-md" />

      {stats > 0 && (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: stats }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      <div className="mt-8 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>

      <span className="sr-only">Loading</span>
    </div>
  );
}

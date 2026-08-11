import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#FBFAF7] p-6">
      <div className="mx-auto max-w-sm py-8">
        <PageSkeleton rows={2} />
      </div>
    </main>
  );
}

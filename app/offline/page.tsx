export const metadata = { title: "No connection" };

export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-[#FBFAF7] text-[#16202B]">
      <div className="max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
          General Science Laboratory
        </p>
        <h1 className="mt-1 mb-3 text-2xl font-medium">No connection</h1>
        <p className="text-sm text-[#5A6B7A] leading-relaxed">
          Attendance has to reach the server to be recorded, so scanning needs
          a connection. Move closer to the wifi or switch on mobile data, then
          try again.
        </p>
        <p className="mt-4 text-sm text-[#5A6B7A] leading-relaxed">
          If it still will not connect, tell your teacher — they can mark you
          manually.
        </p>
      </div>
    </main>
  );
}

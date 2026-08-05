import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { requireAdmin } from "@/lib/require-admin";
import { getServiceClient } from "@/lib/supabase/admin";
import { makeStaticToken, tokenUrl } from "@/lib/qr-token";
import { Card } from "@/components/admin-ui";
import PrintButton from "./print-button";
import EditRoomForm, { type Room } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  // The signing secret is read here, on the server, and used to mint the code.
  // It is never sent to the browser — only the resulting image is.
  const service = getServiceClient();
  const { data } = await service
    .from("rooms")
    .select("id, code, name, qr_secret, lat, lng, geofence_m, allow_static_qr")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const room = data as Room & { qr_secret: string };

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const token = makeStaticToken(room.id, room.qr_secret);
  const dataUrl = await QRCode.toDataURL(tokenUrl(origin, token), {
    errorCorrectionLevel: "H", // survives scuffs, tape and poor printing
    margin: 2,
    width: 900,
    color: { dark: "#16202B", light: "#FFFFFF" },
  });

  const hasCoords = room.lat !== null && room.lng !== null;

  return (
    <>
      <div className="print:hidden">
        <Link
          href="/admin/rooms"
          className="text-sm text-[#5A6B7A] underline underline-offset-4 hover:text-[#0B6E5F]"
        >
          All laboratories
        </Link>

        <header className="mt-4 mb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#5A6B7A]">
            Laboratory code
          </p>
          <h1 className="mt-1 text-2xl font-medium">{room.name}</h1>
        </header>

        {!room.allow_static_qr && (
          <p className="mb-6 text-sm text-[#A8321F] border-l-2 border-[#A8321F] pl-3">
            Printed codes are switched off for this laboratory, so scans of
            this sheet will be rejected.
          </p>
        )}

        {!hasCoords && (
          <p className="mb-6 text-sm text-[#A8321F] border-l-2 border-[#A8321F] pl-3">
            No coordinates, so the location check can't run and every scan will
            fail. Add them below before printing.
          </p>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <div>
          {/* The printable sheet. */}
          <div className="bg-white border border-[#D8DFE5] rounded-lg p-10 text-center print:border-0 print:p-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#5A6B7A]">
              General Science Laboratory
            </p>
            <p className="mt-2 font-mono text-5xl tracking-[0.08em]">
              {room.code}
            </p>
            <p className="mt-1 text-lg">{room.name}</p>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={`Attendance QR code for ${room.name}`}
              className="mx-auto mt-8 w-full max-w-[380px]"
            />

            <p className="mt-8 text-sm text-[#5A6B7A] max-w-sm mx-auto leading-relaxed">
              Sign in first, then scan. Attendance only records while your
              teacher has the class open.
            </p>
          </div>

          <div className="print:hidden mt-6 flex gap-3 flex-wrap">
            <PrintButton />
            <a
              href={dataUrl}
              download={`${room.code}-qr.png`}
              className="border border-[#16202B] rounded py-2.5 px-5 text-sm hover:bg-[#16202B] hover:text-white transition-colors"
            >
              Download PNG
            </a>
          </div>

          <div className="print:hidden mt-6 bg-white border border-[#D8DFE5] rounded-lg p-6 text-sm leading-relaxed space-y-3">
            <h2 className="font-medium">Before you print</h2>
            <p className="text-[#5A6B7A]">
              This code identifies the room and nothing else — no student or
              teacher information is in it, so a photograph reveals nothing and
              grants nothing on its own.
            </p>
            <p className="text-[#5A6B7A]">
              A scan is recorded only when all three hold: the teacher has
              opened the class, the student is enrolled in that section, and
              their phone is within {room.geofence_m} metres of the laboratory.
            </p>
            <p className="text-[#5A6B7A]">
              Print at least A5 and mount it at eye height, away from glare.
              Laminating helps — a torn code stops working.
            </p>
          </div>
        </div>

        <div className="print:hidden">
          <Card>
            <EditRoomForm room={room} />
          </Card>
        </div>
      </div>
    </>
  );
}

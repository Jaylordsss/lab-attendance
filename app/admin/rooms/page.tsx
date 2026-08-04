import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Empty, Th, Td } from "@/components/admin-ui";
import RoomForm from "./form";
import { setStaticQr } from "./actions";

export const dynamic = "force-dynamic";

type Room = {
  id: string;
  code: string;
  name: string;
  lat: number | null;
  lng: number | null;
  geofence_m: number;
  allow_static_qr: boolean;
};

export default async function RoomsPage() {
  const supabase = await createClient();
  // qr_secret is deliberately not selected. It never leaves the server.
  const { data } = await supabase
    .from("rooms")
    .select("id, code, name, lat, lng, geofence_m, allow_static_qr")
    .order("code");

  const rooms = (data ?? []) as Room[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Laboratories">
        Each laboratory gets its own signing secret, generated here and never
        shown. Teachers display a rotating QR from their dashboard; a printed
        code is an optional fallback that also requires GPS.
      </PageHeader>

      <div className="grid gap-8 md:grid-cols-[1fr_320px] md:items-start">
        <section>
          {rooms.length === 0 ? (
            <Empty>
              No laboratories yet. Add your first one to start scheduling
              sections.
            </Empty>
          ) : (
            <div className="bg-white border border-[#D8DFE5] rounded-lg p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8ED]">
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Geofence</Th>
                    <Th>Printed QR</Th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id} className="border-b border-[#F0F3F5]">
                      <Td>
                        <span className="font-mono">{room.code}</span>
                      </Td>
                      <Td>{room.name}</Td>
                      <Td>
                        {room.lat === null || room.lng === null ? (
                          <span className="text-[#5A6B7A]">No coordinates</span>
                        ) : (
                          `${room.geofence_m} m`
                        )}
                      </Td>
                      <Td>
                        <form action={setStaticQr}>
                          <input type="hidden" name="id" value={room.id} />
                          <input
                            type="hidden"
                            name="enable"
                            value={String(!room.allow_static_qr)}
                          />
                          <button
                            type="submit"
                            className="text-sm underline underline-offset-4 hover:text-[#0B6E5F]"
                          >
                            {room.allow_static_qr ? "Allowed" : "Off"}
                          </button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card>
          <RoomForm />
        </Card>
      </div>
    </>
  );
}

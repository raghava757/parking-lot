import { resetLot } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* POST /api/reset — restore a fresh seeded lot, clear queue & logs */
export async function POST() {
  const r = await resetLot();
  return Response.json(r);
}

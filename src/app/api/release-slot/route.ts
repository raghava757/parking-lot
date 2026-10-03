import { releaseSlot } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* POST /api/release-slot — free up a parking slot by ID */
export async function POST(req: Request) {
  let body: { slotId?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const slotId = Number(body.slotId);
  if (!Number.isInteger(slotId) || slotId <= 0) {
    return Response.json({ error: "slotId must be a positive integer" }, { status: 400 });
  }
  const result = await releaseSlot(slotId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  return Response.json(result);
}

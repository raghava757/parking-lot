import {
  enqueueVehicle,
  ensureSeeded,
  serveHead,
} from "@/lib/engine";
import { VehicleSize } from "@/lib/allocator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIZES: VehicleSize[] = ["Bike", "Small", "Medium", "Large"];

/*
 * POST /api/request-parking
 * Body: { licensePlate?, vehicleSize, priorityLevel }
 *
 * The request is PUSHED onto the priority queue; then the heap HEAD
 * (which may be a different, more urgent vehicle) is extracted and
 * served through Binary Search + Greedy allocation.
 */
export async function POST(req: Request) {
  await ensureSeeded();
  let body: { licensePlate?: string; vehicleSize?: string; priorityLevel?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const size = body.vehicleSize as VehicleSize;
  const priority = Number(body.priorityLevel);
  if (!SIZES.includes(size)) {
    return Response.json({ error: "vehicleSize must be Bike | Small | Medium | Large" }, { status: 400 });
  }
  if (![1, 2, 3].includes(priority)) {
    return Response.json({ error: "priorityLevel must be 1, 2 or 3" }, { status: 400 });
  }

  const submitted = await enqueueVehicle({
    licensePlate: body.licensePlate,
    vehicleSize: size,
    priorityLevel: priority,
  });

  const served = await serveHead();
  if (!served) {
    return Response.json({ error: "Queue unexpectedly empty" }, { status: 500 });
  }

  return Response.json({
    submitted,
    headOfLineBlocking: served.served.vehicleId !== submitted.vehicleId,
    ...served,
  });
}

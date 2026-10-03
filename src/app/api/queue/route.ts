import { db } from "@/db";
import { queueEntries, vehicles } from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  buildHeap,
  enqueueVehicle,
  ensureSeeded,
  getQueueItems,
} from "@/lib/engine";
import { VehicleSize } from "@/lib/allocator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIZES: VehicleSize[] = ["Bike", "Small", "Medium", "Large"];

/* GET /api/queue — exact heap pop-order snapshot + heap stats */
export async function GET() {
  await ensureSeeded();
  const items = await getQueueItems();
  const heap = buildHeap(items);
  return Response.json({
    size: items.length,
    popOrder: heap.popOrder(),
    heapOps: { pushes: heap.pushes, swaps: heap.swaps },
  });
}

/* POST /api/queue — enqueue WITHOUT serving (batch simulation) */
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
  if (!SIZES.includes(size) || ![1, 2, 3].includes(priority)) {
    return Response.json({ error: "Invalid vehicleSize or priorityLevel" }, { status: 400 });
  }
  const item = await enqueueVehicle({
    licensePlate: body.licensePlate,
    vehicleSize: size,
    priorityLevel: priority,
  });
  const items = await getQueueItems();
  const heap = buildHeap(items);
  return Response.json({
    enqueued: item,
    size: items.length,
    popOrder: heap.popOrder(),
    heapOps: { pushes: heap.pushes, swaps: heap.swaps },
  });
}

/* DELETE /api/queue — clear all pending requests */
export async function DELETE() {
  await ensureSeeded();
  await db.delete(queueEntries);
  await db
    .update(vehicles)
    .set({ status: "LEFT" })
    .where(sql`${vehicles.status} IN ('QUEUED','WAITING')`);
  return Response.json({ ok: true });
}

import { db } from "@/db";
import { parkingSlots } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ensureSeeded, getQueueItems } from "@/lib/engine";
import { buildHeap } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* GET /api/slots — current state of every slot + lot statistics */
export async function GET() {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(parkingSlots)
    .orderBy(asc(parkingSlots.distanceFromEntrance), asc(parkingSlots.id));

  const occupied = rows.filter((r) => r.isOccupied).length;
  const freeBySize = {
    Bike: rows.filter((r) => !r.isOccupied && r.size === "Bike").length,
    Small: rows.filter((r) => !r.isOccupied && r.size === "Small").length,
    Medium: rows.filter((r) => !r.isOccupied && r.size === "Medium").length,
    Large: rows.filter((r) => !r.isOccupied && r.size === "Large").length,
  };
  const queue = buildHeap(await getQueueItems()).popOrder();

  return Response.json({
    slots: rows.map((r) => ({
      id: r.id,
      slotNumber: r.slotNumber,
      size: r.size,
      distance: r.distanceFromEntrance,
      zone: r.zone,
      isOccupied: r.isOccupied,
      occupiedByPlate: r.occupiedByPlate,
    })),
    stats: {
      total: rows.length,
      occupied,
      free: rows.length - occupied,
      occupancyRate: rows.length ? Math.round((occupied / rows.length) * 100) : 0,
      freeBySize,
      queueLength: queue.length,
      nextUp: queue[0] ?? null,
    },
  });
}

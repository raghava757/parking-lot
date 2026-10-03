import { db } from "@/db";
import { allocationLogs, parkingSlots, queueEntries, vehicles } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  AllocationTrace,
  MinHeap,
  QueueItem,
  SlotCandidate,
  VehicleSize,
  nearestFitSearch,
  randomPlate,
} from "./allocator";

/* ================================================================== */
/* SEED — deterministic 61-slot lot: bike ring + four car zones        */
/* ================================================================== */
const SEED_SLOTS: Array<{ n: string; size: VehicleSize; d: number; zone: string }> = [
  /* ---- Zone K — bike ring (2–23 m) ---- */
  { n: "K1", size: "Bike", d: 2, zone: "K" },
  { n: "K2", size: "Bike", d: 4, zone: "K" },
  { n: "K3", size: "Bike", d: 5, zone: "K" },
  { n: "K4", size: "Bike", d: 7, zone: "K" },
  { n: "K5", size: "Bike", d: 8, zone: "K" },
  { n: "K6", size: "Bike", d: 10, zone: "K" },
  { n: "K7", size: "Bike", d: 11, zone: "K" },
  { n: "K8", size: "Bike", d: 13, zone: "K" },
  { n: "K9", size: "Bike", d: 14, zone: "K" },
  { n: "K10", size: "Bike", d: 16, zone: "K" },
  { n: "K11", size: "Bike", d: 17, zone: "K" },
  { n: "K12", size: "Bike", d: 19, zone: "K" },
  { n: "K13", size: "Bike", d: 20, zone: "K" },
  { n: "K14", size: "Bike", d: 22, zone: "K" },
  { n: "K15", size: "Bike", d: 23, zone: "K" },
  /* ---- Zone A — near field (12–37 m) ---- */
  { n: "A1", size: "Small", d: 12, zone: "A" },
  { n: "A2", size: "Small", d: 15, zone: "A" },
  { n: "A3", size: "Medium", d: 18, zone: "A" },
  { n: "A4", size: "Large", d: 21, zone: "A" },
  { n: "A5", size: "Small", d: 24, zone: "A" },
  { n: "A6", size: "Medium", d: 27, zone: "A" },
  { n: "A7", size: "Small", d: 30, zone: "A" },
  { n: "A8", size: "Medium", d: 32, zone: "A" },
  { n: "A9", size: "Large", d: 34, zone: "A" },
  { n: "A10", size: "Medium", d: 37, zone: "A" },
  /* ---- Zone B — mid field (44–83 m) ---- */
  { n: "B1", size: "Medium", d: 44, zone: "B" },
  { n: "B2", size: "Small", d: 47, zone: "B" },
  { n: "B3", size: "Large", d: 50, zone: "B" },
  { n: "B4", size: "Medium", d: 54, zone: "B" },
  { n: "B5", size: "Small", d: 57, zone: "B" },
  { n: "B6", size: "Medium", d: 60, zone: "B" },
  { n: "B7", size: "Large", d: 64, zone: "B" },
  { n: "B8", size: "Medium", d: 68, zone: "B" },
  { n: "B9", size: "Small", d: 71, zone: "B" },
  { n: "B10", size: "Medium", d: 75, zone: "B" },
  { n: "B11", size: "Large", d: 79, zone: "B" },
  { n: "B12", size: "Small", d: 83, zone: "B" },
  /* ---- Zone C — far field (91–135 m) ---- */
  { n: "C1", size: "Medium", d: 91, zone: "C" },
  { n: "C2", size: "Large", d: 95, zone: "C" },
  { n: "C3", size: "Small", d: 99, zone: "C" },
  { n: "C4", size: "Medium", d: 103, zone: "C" },
  { n: "C5", size: "Large", d: 107, zone: "C" },
  { n: "C6", size: "Medium", d: 111, zone: "C" },
  { n: "C7", size: "Small", d: 115, zone: "C" },
  { n: "C8", size: "Medium", d: 119, zone: "C" },
  { n: "C9", size: "Large", d: 123, zone: "C" },
  { n: "C10", size: "Medium", d: 127, zone: "C" },
  { n: "C11", size: "Small", d: 131, zone: "C" },
  { n: "C12", size: "Large", d: 135, zone: "C" },
  /* ---- Zone D — overflow (142–197 m) ---- */
  { n: "D1", size: "Large", d: 142, zone: "D" },
  { n: "D2", size: "Medium", d: 147, zone: "D" },
  { n: "D3", size: "Small", d: 152, zone: "D" },
  { n: "D4", size: "Large", d: 157, zone: "D" },
  { n: "D5", size: "Medium", d: 162, zone: "D" },
  { n: "D6", size: "Medium", d: 167, zone: "D" },
  { n: "D7", size: "Large", d: 172, zone: "D" },
  { n: "D8", size: "Small", d: 177, zone: "D" },
  { n: "D9", size: "Medium", d: 182, zone: "D" },
  { n: "D10", size: "Large", d: 187, zone: "D" },
  { n: "D11", size: "Medium", d: 192, zone: "D" },
  { n: "D12", size: "Large", d: 197, zone: "D" },
];
const INITIAL_OCCUPANTS = [
  "K3", "K9", "K13",
  "A2", "A5", "A8",
  "B2", "B5", "B9", "B12",
  "C4", "C8", "C11",
  "D3", "D6", "D10",
];

let seedPromise: Promise<void> | null = null;
export function ensureSeeded(): Promise<void> {
  if (!seedPromise) seedPromise = seed();
  return seedPromise;
}
async function seed(): Promise<void> {
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(parkingSlots);
  if (c === SEED_SLOTS.length) return;
  /* lot layout changed (e.g. upgraded to bike ring + more zones) —
     wipe volatile state and reseed the full lot */
  await db.delete(queueEntries);
  await db
    .update(vehicles)
    .set({ status: "LEFT" })
    .where(sql`${vehicles.status} IN ('QUEUED','WAITING')`);
  await db.delete(allocationLogs);
  await db.delete(parkingSlots);
  await db.insert(parkingSlots).values(
    SEED_SLOTS.map((s) => {
      const occupied = INITIAL_OCCUPANTS.includes(s.n);
      return {
        slotNumber: s.n,
        size: s.size,
        distanceFromEntrance: s.d,
        zone: s.zone,
        isOccupied: occupied,
        occupiedByPlate: occupied ? randomPlate() : null, // pre-seeded ghost cars
        occupiedByVehicleId: null,
      };
    }),
  );
}

/* ================================================================== */
/* READ MODELS                                                         */
/* ================================================================== */
export async function getQueueItems(): Promise<QueueItem[]> {
  const rows = await db
    .select({
      vehicleId: vehicles.id,
      licensePlate: vehicles.licensePlate,
      vehicleSize: vehicles.vehicleSize,
      priorityLevel: vehicles.priorityLevel,
      arrivalTime: vehicles.arrivalTime,
    })
    .from(queueEntries)
    .innerJoin(vehicles, eq(queueEntries.vehicleId, vehicles.id))
    .orderBy(asc(queueEntries.id));
  return rows.map((r) => ({
    vehicleId: r.vehicleId,
    licensePlate: r.licensePlate,
    vehicleSize: r.vehicleSize as VehicleSize,
    priorityLevel: r.priorityLevel,
    arrivalTime: r.arrivalTime.toISOString(),
  }));
}

export function buildHeap(items: QueueItem[]): MinHeap {
  const heap = new MinHeap();
  for (const it of items) heap.push(it);
  return heap;
}

async function freeSlotsByDistance(): Promise<SlotCandidate[]> {
  const rows = await db
    .select()
    .from(parkingSlots)
    .where(eq(parkingSlots.isOccupied, false))
    .orderBy(asc(parkingSlots.distanceFromEntrance), asc(parkingSlots.id));
  return rows.map((r) => ({
    id: r.id,
    slotNumber: r.slotNumber,
    size: r.size as VehicleSize,
    distance: r.distanceFromEntrance,
    zone: r.zone,
  }));
}

/* ================================================================== */
/* WRITE OPS                                                           */
/* ================================================================== */
export async function enqueueVehicle(input: {
  licensePlate?: string;
  vehicleSize: VehicleSize;
  priorityLevel: number;
}): Promise<QueueItem> {
  const plate = (input.licensePlate ?? "").trim() || randomPlate();
  const [v] = await db
    .insert(vehicles)
    .values({
      licensePlate: plate.toUpperCase(),
      vehicleSize: input.vehicleSize,
      priorityLevel: input.priorityLevel,
      status: "QUEUED",
    })
    .returning();
  await db.insert(queueEntries).values({ vehicleId: v.id });
  return {
    vehicleId: v.id,
    licensePlate: v.licensePlate,
    vehicleSize: v.vehicleSize as VehicleSize,
    priorityLevel: v.priorityLevel,
    arrivalTime: v.arrivalTime.toISOString(),
  };
}

export interface ServeResult {
  served: QueueItem;
  result: "ALLOCATED" | "WAITING";
  assignedSlot: (SlotCandidate & { id: number }) | null;
  trace: AllocationTrace;
  logId: number;
  note: string;
}

/** Pop the heap head and run Binary-Search + Greedy allocation for it. */
export async function serveHead(): Promise<ServeResult | null> {
  await ensureSeeded();
  const items = await getQueueItems();
  if (items.length === 0) return null;

  const heap = buildHeap(items);
  const queueBefore = heap.popOrder();
  const head = heap.pop()!; // highest priority, then earliest arrival
  const queueAfter = heap.popOrder();

  const freeSorted = await freeSlotsByDistance();
  const search = nearestFitSearch(freeSorted, head);

  const trace: AllocationTrace = {
    queue: {
      before: queueBefore,
      after: queueAfter,
      pushes: heap.pushes,
      pops: heap.pops,
      swaps: heap.swaps,
    },
    search,
  };

  if (search.chosen) {
    /* ------------- commit: allocate (greedy optimum) ------------- */
    await db.delete(queueEntries).where(eq(queueEntries.vehicleId, head.vehicleId));
    await db
      .update(parkingSlots)
      .set({
        isOccupied: true,
        occupiedByPlate: head.licensePlate,
        occupiedByVehicleId: head.vehicleId,
      })
      .where(eq(parkingSlots.id, search.chosen.id));
    await db
      .update(vehicles)
      .set({ status: "PARKED", assignedSlotId: search.chosen.id })
      .where(eq(vehicles.id, head.vehicleId));
    const [log] = await db
      .insert(allocationLogs)
      .values({
        vehicleId: head.vehicleId,
        licensePlate: head.licensePlate,
        vehicleSize: head.vehicleSize,
        priorityLevel: head.priorityLevel,
        slotId: search.chosen.id,
        slotNumber: search.chosen.slotNumber,
        result: "ALLOCATED",
        comparisons: search.comparisons,
        heapOps: heap.swaps + heap.pushes + heap.pops,
        slotsScanned: search.slotsScanned,
        explanation: search.greedy.explanation,
        trace: trace as unknown as Record<string, unknown>,
      })
      .returning({ id: allocationLogs.id });
    return {
      served: head,
      result: "ALLOCATED",
      assignedSlot: search.chosen,
      trace,
      logId: log.id,
      note: "Heap head extracted → binary search located nearest-fit bound → greedy commitment locked the minimum-distance feasible slot.",
    };
  }

  /* ------------- no feasible slot: head stays queued (blocked) --- */
  await db
    .update(vehicles)
    .set({ status: "WAITING" })
    .where(eq(vehicles.id, head.vehicleId));
  const [log] = await db
    .insert(allocationLogs)
    .values({
      vehicleId: head.vehicleId,
      licensePlate: head.licensePlate,
      vehicleSize: head.vehicleSize,
      priorityLevel: head.priorityLevel,
      result: "WAITING",
      comparisons: search.comparisons,
      heapOps: heap.swaps + heap.pushes + heap.pops,
      slotsScanned: search.slotsScanned,
      explanation: search.greedy.explanation,
      trace: trace as unknown as Record<string, unknown>,
    })
    .returning({ id: allocationLogs.id });
  return {
    served: head,
    result: "WAITING",
    assignedSlot: null,
    trace,
    logId: log.id,
    note: "Head-of-line blocking: the highest-priority request cannot fit anywhere, so it remains at the front of the priority queue.",
  };
}

export async function releaseSlot(slotId: number) {
  await ensureSeeded();
  const [slot] = await db
    .select()
    .from(parkingSlots)
    .where(eq(parkingSlots.id, slotId));
  if (!slot) return { ok: false as const, error: "Slot not found" };
  if (!slot.isOccupied) return { ok: false as const, error: "Slot is already free" };

  await db
    .update(parkingSlots)
    .set({ isOccupied: false, occupiedByPlate: null, occupiedByVehicleId: null })
    .where(eq(parkingSlots.id, slotId));
  if (slot.occupiedByVehicleId) {
    await db
      .update(vehicles)
      .set({ status: "LEFT" })
      .where(eq(vehicles.id, slot.occupiedByVehicleId));
  }
  await db.insert(allocationLogs).values({
    vehicleId: slot.occupiedByVehicleId,
    licensePlate: slot.occupiedByPlate ?? "UNKNOWN",
    vehicleSize: slot.size,
    priorityLevel: 3,
    slotId: slot.id,
    slotNumber: slot.slotNumber,
    result: "RELEASED",
    explanation: `Slot ${slot.slotNumber} released → free-slot set updated and will be re-sorted into the binary-search array on the next allocation cycle.`,
  });
  const waiting = await getQueueItems();
  return {
    ok: true as const,
    slot: {
      id: slot.id,
      slotNumber: slot.slotNumber,
      size: slot.size as VehicleSize,
      distance: slot.distanceFromEntrance,
      zone: slot.zone,
    },
    releasedPlate: slot.occupiedByPlate,
    queuedWaiting: waiting.length,
  };
}

export async function resetLot() {
  await db.delete(queueEntries);
  await db
    .update(vehicles)
    .set({ status: "LEFT" })
    .where(sql`${vehicles.status} IN ('QUEUED','WAITING')`);
  await db.delete(allocationLogs);
  await db.delete(parkingSlots);
  seedPromise = null;
  await ensureSeeded();
  return { ok: true };
}

export async function recentLogs(limit = 40) {
  return db
    .select()
    .from(allocationLogs)
    .orderBy(desc(allocationLogs.createdAt), desc(allocationLogs.id))
    .limit(limit);
}

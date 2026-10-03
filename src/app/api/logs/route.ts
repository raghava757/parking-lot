import { ensureSeeded, recentLogs } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* GET /api/logs — historical allocation logs (with full algo traces) */
export async function GET(req: Request) {
  await ensureSeeded();
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40)));
  const logs = await recentLogs(limit);
  return Response.json({
    logs: logs.map((l) => ({
      id: l.id,
      vehicleId: l.vehicleId,
      licensePlate: l.licensePlate,
      vehicleSize: l.vehicleSize,
      priorityLevel: l.priorityLevel,
      slotId: l.slotId,
      slotNumber: l.slotNumber,
      result: l.result,
      comparisons: l.comparisons,
      heapOps: l.heapOps,
      slotsScanned: l.slotsScanned,
      explanation: l.explanation,
      trace: l.trace,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

import { ensureSeeded, serveHead, ServeResult, getQueueItems } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/*
 * POST /api/queue/process
 * Body: { mode: "next" | "all" }
 * Serves the priority-queue head(s), stopping early on head-of-line
 * blocking so the blocking behaviour itself stays visible.
 */
export async function POST(req: Request) {
  await ensureSeeded();
  let body: { mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body defaults to next */
  }
  const mode = body.mode === "all" ? "all" : "next";

  const results: ServeResult[] = [];
  const first = await serveHead();
  if (!first) {
    return Response.json({ processed: 0, results: [], blocked: false, message: "Queue is empty." });
  }
  results.push(first);

  if (mode === "all") {
    for (let i = 0; i < 200; i++) {
      if (results[results.length - 1].result === "WAITING") break; // head blocked
      const r = await serveHead();
      if (!r) break;
      results.push(r);
    }
  }

  const remaining = (await getQueueItems()).length;
  return Response.json({
    processed: results.filter((r) => r.result === "ALLOCATED").length,
    results,
    blocked: results[results.length - 1].result === "WAITING",
    remaining,
    message:
      results[results.length - 1].result === "WAITING"
        ? `Blocked: ${results[results.length - 1].served.licensePlate} (${results[results.length - 1].served.vehicleSize}) cannot fit any free slot — priority queue head is preserved.`
        : `${results.length} vehicle(s) processed through the full heap → binary-search → greedy pipeline.`,
  });
}

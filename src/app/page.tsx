"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radar, Activity, Database, Layers, TimerReset } from "lucide-react";
import type {
  AllocationTrace,
  LogDto,
  ProcessResponse,
  QueueResponse,
  ServePayload,
  SlotDto,
  SlotsResponse,
  VehicleSize,
} from "@/lib/dto";
import ParkingMap from "@/components/parking-map";
import ControlDeck from "@/components/control-deck";
import Inspector from "@/components/inspector";
import LogsTable from "@/components/logs-table";

interface Toast {
  id: number;
  kind: "ok" | "warn" | "info" | "err";
  title: string;
  sub?: string;
}

const TOAST_BORDER: Record<Toast["kind"], string> = {
  ok: "#34d399",
  warn: "#fbbf24",
  info: "#22d3ee",
  err: "#fb4d6d",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

export default function Page() {
  const [slotsRes, setSlotsRes] = useState<SlotsResponse | null>(null);
  const [queueRes, setQueueRes] = useState<QueueResponse | null>(null);
  const [logs, setLogs] = useState<LogDto[]>([]);
  const [trace, setTrace] = useState<AllocationTrace | null>(null);
  const [traceSource, setTraceSource] = useState<string | null>(null);
  const [requestTab, setRequestTab] = useState<{ tab: "queue" | "search" | "greedy"; nonce: number } | null>(null);
  const [hotSlotId, setHotSlotId] = useState<number | null>(null);
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clock, setClock] = useState<string>("");
  const toastSeq = useRef(0);
  const hotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushToast = useCallback((kind: Toast["kind"], title: string, sub?: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-2), { id, kind, title, sub }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, q, l] = await Promise.all([
        api<SlotsResponse>("/api/slots"),
        api<QueueResponse>("/api/queue"),
        api<{ logs: LogDto[] }>("/api/logs?limit=40"),
      ]);
      setSlotsRes(s);
      setQueueRes(q);
      setLogs(l.logs);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 2500);
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false })), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  const adoptTrace = useCallback(
    (r: ServePayload, sourcePrefix: string) => {
      setTrace(r.trace);
      setTraceSource(`${sourcePrefix} · LOG #${r.logId} · ${r.served.licensePlate}`);
      setActiveLogId(r.logId);
      setRequestTab((x) => ({ tab: "search", nonce: (x?.nonce ?? 0) + 1 }));
      if (r.assignedSlot) {
        setHotSlotId(r.assignedSlot.id);
        if (hotTimer.current) clearTimeout(hotTimer.current);
        hotTimer.current = setTimeout(() => setHotSlotId(null), 9000);
      }
    },
    [],
  );

  /* ---------------- actions ---------------- */
  const guard = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        pushToast("err", "Request failed", e instanceof Error ? e.message : undefined);
      } finally {
        setBusy(false);
        refresh();
      }
    },
    [pushToast, refresh],
  );

  const requestAllocate = (size: VehicleSize, priority: number, plate: string) =>
    guard(async () => {
      const r = await api<ServePayload & { submitted: { licensePlate: string }; headOfLineBlocking: boolean }>(
        "/api/request-parking",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ licensePlate: plate || undefined, vehicleSize: size, priorityLevel: priority }),
        },
      );
      adoptTrace(r, "LIVE");
      if (r.headOfLineBlocking)
        pushToast("info", "Priority preemption", `${r.submitted.licensePlate} joined the queue — more urgent ${r.served.licensePlate} was extracted first.`);
      if (r.result === "ALLOCATED")
        pushToast("ok", `${r.served.licensePlate} → SLOT ${r.assignedSlot?.slotNumber}`, `${r.trace.search.comparisons} binary-search comparisons · ${r.trace.queue.swaps} heap swaps · greedy: minimum-distance fit.`);
      else pushToast("warn", `${r.served.licensePlate} could not be placed`, "No free slot fits — request stays at the priority queue head.");
    });

  const queueOnly = (size: VehicleSize, priority: number, plate: string) =>
    guard(async () => {
      await api("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licensePlate: plate || undefined, vehicleSize: size, priorityLevel: priority }),
      });
      pushToast("info", "Pushed onto heap", `${size} · P${priority} parked in the priority queue — nothing served yet.`);
    });

  const process = (mode: "next" | "all") =>
    guard(async () => {
      const r = await api<ProcessResponse>("/api/queue/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (r.results.length === 0) {
        pushToast("info", "Queue empty", "Nothing to process — queue some vehicles first.");
        return;
      }
      adoptTrace(r.results[r.results.length - 1], mode === "all" ? "BATCH" : "SINGLE");
      pushToast(r.blocked ? "warn" : "ok", `${r.processed} vehicle(s) allocated`, r.message);
    });

  const simulateRush = () =>
    guard(async () => {
      const sizes: VehicleSize[] = ["Bike", "Small", "Small", "Medium", "Medium", "Medium", "Large", "Small", "Large", "Bike"];
      const pris = [3, 3, 3, 2, 3, 2, 1, 3, 2, 3];
      for (let i = 0; i < 6; i++) {
        await api("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicleSize: sizes[Math.floor(Math.random() * sizes.length)],
            priorityLevel: pris[Math.floor(Math.random() * pris.length)],
          }),
        });
      }
      pushToast("info", "Rush simulated", "6 vehicles pushed onto the priority queue — watch the heap reorder in the inspector.");
      setRequestTab((x) => ({ tab: "queue", nonce: (x?.nonce ?? 0) + 1 }));
    });

  const clearQueue = () =>
    guard(async () => {
      await api("/api/queue", { method: "DELETE" });
      pushToast("info", "Queue cleared", "All waiting vehicles left the lot.");
    });

  const reset = () =>
    guard(async () => {
      await api("/api/reset", { method: "POST" });
      setTrace(null);
      setTraceSource(null);
      setActiveLogId(null);
      setHotSlotId(null);
      pushToast("warn", "Lot reset", "Slot inventory re-seeded, queue and logs wiped.");
    });

  const release = (slotId: number) =>
    guard(async () => {
      setReleasingId(slotId);
      try {
        const r = await api<{ slot: SlotDto; releasedPlate: string | null; queuedWaiting: number }>("/api/release-slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId }),
        });
        pushToast(
          "warn",
          `Slot ${r.slot.slotNumber} released`,
          r.queuedWaiting > 0 ? `${r.queuedWaiting} vehicle(s) waiting — process the queue to re-allocate.` : `${r.releasedPlate ?? "Vehicle"} left. The free-slot array re-sorts on the next allocation.`,
        );
      } finally {
        setReleasingId(null);
      }
    });

  const inspectLog = (log: LogDto) => {
    if (!log.trace) return;
    setTrace(log.trace);
    setTraceSource(`REPLAY · LOG #${log.id} · ${log.licensePlate}`);
    setActiveLogId(log.id);
    setRequestTab((x) => ({ tab: "search", nonce: (x?.nonce ?? 0) + 1 }));
    if (typeof window !== "undefined")
      document.getElementById("inspector-anchor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const stats = slotsRes?.stats;
  const avgCmp = (() => {
    const a = logs.filter((l) => l.result === "ALLOCATED");
    if (!a.length) return "—";
    return (a.reduce((s, l) => s + l.comparisons, 0) / a.length).toFixed(1);
  })();

  return (
    <div className="relative z-10 mx-auto max-w-[1520px] px-4 md:px-6 pb-10">
      {/* =============== header =============== */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5 border-b border-[#141b28]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34d399] to-[#0d9464] flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(52,211,153,.6)]">
            <Radar className="w-5 h-5 text-[#03170f]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              SLOT<span className="text-[#34d399]">//</span>PILOT
            </h1>
            <div className="micro-label !text-[8.5px] mt-1">ALGORITHM-TRANSPARENT PARKING ALLOCATOR</div>
          </div>
        </div>

        <div className="flex items-center gap-5 flex-wrap ml-auto">
          <HeadStat label="Occupancy" value={stats ? `${stats.occupancyRate}%` : "—"} sub={stats ? `${stats.occupied}/${stats.total} bays` : ""} />
          <HeadStat label="Free by size" value={stats ? `${stats.freeBySize.Bike}·${stats.freeBySize.Small}·${stats.freeBySize.Medium}·${stats.freeBySize.Large}` : "—"} sub="B · S · M · L" accent="#34d399" />
          <HeadStat label="Queue" value={String(stats?.queueLength ?? queueRes?.size ?? 0)} sub={stats?.nextUp ? `next: ${stats.nextUp.licensePlate}` : "empty"} accent="#a78bfa" />
          <HeadStat label="Avg comparisons" value={avgCmp} sub="per allocation" accent="#fbbf24" />
          <div className="hidden md:flex flex-col items-end gap-1">
            <span className="flex items-center gap-1.5 font-mono2 text-[11px] text-[#7d8aa0]">
              <span className="live-dot" /> {clock || "········"}
            </span>
            <span className="flex items-center gap-1.5 font-mono2 text-[9px] tracking-[0.16em] text-[#4b586e]">
              <Database className="w-3 h-3" /> POSTGRESQL · DRIZZLE ORM
            </span>
          </div>
        </div>
      </header>

      {/* =============== body =============== */}
      <main className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_404px] gap-4 mt-4">
        <div className="flex flex-col gap-4 min-w-0">
          {slotsRes ? (
            <ParkingMap
              slots={slotsRes.slots}
              hotSlotId={hotSlotId}
              releasingId={releasingId}
              onRelease={release}
              waitingCount={stats?.queueLength ?? 0}
            />
          ) : (
            <div className="panel h-[380px] flex items-center justify-center">
              <span className="font-mono2 text-xs text-[#4b586e] tracking-[0.25em] animate-pulse">CONNECTING TO LOT…</span>
            </div>
          )}
          <LogsTable logs={logs} activeLogId={activeLogId} onInspect={inspectLog} />
        </div>

        <div className="flex flex-col gap-4 min-w-0" id="inspector-anchor">
          <ControlDeck
            busy={busy}
            onRequestAllocate={requestAllocate}
            onQueueOnly={queueOnly}
            onProcess={process}
            onSimulateRush={simulateRush}
            onClearQueue={clearQueue}
            onReset={reset}
          />
          <Inspector trace={trace} sourceLabel={traceSource} liveQueue={queueRes?.popOrder ?? []} requestTab={requestTab} />
        </div>
      </main>

      {/* =============== footer marquee =============== */}
      <footer className="mt-6 border-t border-[#141b28] pt-4 overflow-hidden">
        <div className="flex gap-8 whitespace-nowrap font-mono2 text-[10px] tracking-[0.3em] text-[#39445a]" style={{ animation: "marquee 40s linear infinite", width: "max-content" }}>
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-8 items-center">
              <span className="flex items-center gap-2"><Layers className="w-3 h-3" /> BINARY MIN-HEAP · EXTRACT-MIN O(LOG N)</span>
              <span>◆</span>
              <span className="flex items-center gap-2"><Activity className="w-3 h-3" /> BINARY SEARCH OVER DISTANCE-SORTED SLOTS · O(LOG N)</span>
              <span>◆</span>
              <span className="flex items-center gap-2"><TimerReset className="w-3 h-3" /> GREEDY MINIMUM-DISTANCE COMMITMENT · LOCALLY OPTIMAL EVERY STEP</span>
              <span>◆</span>
            </span>
          ))}
        </div>
      </footer>

      {/* =============== toasts =============== */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[340px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-fadeUp rounded-xl border border-[#1a2230] bg-[#0b0f16f2] backdrop-blur px-4 py-3 shadow-2xl"
            style={{ borderLeft: `3px solid ${TOAST_BORDER[t.kind]}` }}
          >
            <div className="text-[12.5px] font-semibold text-[#e6edf6]">{t.title}</div>
            {t.sub && <div className="text-[11px] text-[#7d8aa0] mt-0.5 leading-snug">{t.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeadStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="micro-label !text-[8.5px]">{label}</span>
      <span className="font-mono2 text-lg font-bold leading-tight" style={{ color: accent ?? "#e6edf6" }}>
        {value}
      </span>
      {sub && <span className="font-mono2 text-[9px] text-[#4b586e] truncate max-w-[150px]">{sub}</span>}
    </div>
  );
}

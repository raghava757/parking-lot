"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ListOrdered,
  Binary,
  Target,
  Play,
  RotateCcw,
  ArrowDownToLine,
  ArrowRight,
  Braces,
  GitCompareArrows,
  Footprints,
} from "lucide-react";
import type { AllocationTrace, QueueItem } from "@/lib/dto";
import { SIZE_RANK, SIZE_SHORT, priorityLabel } from "@/lib/allocator";
import { EmptyState, Metric, PlateChip, PriorityChip, SectionTitle, SizeGlyph, fmtTime } from "./bits";

type Tab = "queue" | "search" | "greedy";

export default function Inspector({
  trace,
  sourceLabel,
  liveQueue,
  requestTab,
}: {
  trace: AllocationTrace | null;
  sourceLabel: string | null;
  liveQueue: QueueItem[];
  requestTab: { tab: Tab; nonce: number } | null;
}) {
  const [tab, setTab] = useState<Tab>("search");
  useEffect(() => {
    if (requestTab) setTab(requestTab.tab);
  }, [requestTab]);

  return (
    <div className="panel z-10 flex flex-col min-h-[520px]">
      {/* header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-[#141b28]">
        <div className="flex gap-1">
          <button className={`tabbtn ${tab === "queue" ? "on" : ""}`} onClick={() => setTab("queue")}>
            <span className="flex items-center gap-1.5">
              <ListOrdered className="w-3.5 h-3.5" /> 1 · PRIORITY QUEUE
            </span>
          </button>
          <button className={`tabbtn ${tab === "search" ? "on" : ""}`} onClick={() => setTab("search")}>
            <span className="flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5" /> 2 · BINARY SEARCH
            </span>
          </button>
          <button className={`tabbtn ${tab === "greedy" ? "on" : ""}`} onClick={() => setTab("greedy")}>
            <span className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> 3 · GREEDY PICK
            </span>
          </button>
        </div>
        <span className="font-mono2 text-[9.5px] tracking-[0.18em] text-[#4b586e] pb-2">
          {sourceLabel ?? "AWAITING DECISION"}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        {tab === "queue" && <QueuePanel trace={trace} liveQueue={liveQueue} />}
        {tab === "search" && <SearchPanel trace={trace} />}
        {tab === "greedy" && <GreedyPanel trace={trace} />}
      </div>
    </div>
  );
}

/* ================================================================== */
/* TAB 1 — PRIORITY QUEUE                                             */
/* ================================================================== */
function QueuePanel({ trace, liveQueue }: { trace: AllocationTrace | null; liveQueue: QueueItem[] }) {
  const before: QueueItem[] = trace?.queue.before ?? liveQueue;
  const after = trace?.queue.after ?? null;

  if (before.length === 0)
    return (
      <EmptyState
        label="Priority queue is empty"
        sub="Queue vehicle requests from the control deck — the heap orders them by urgency, then arrival time."
      />
    );

  return (
    <div className="anim-fadeUp flex flex-col gap-4">
      <div className="flex items-start gap-6">
        <Metric label="Heap poll order" value={before.length} accent="#a78bfa" />
        {trace && (
          <>
            <Metric label="Push ops" value={trace.queue.pushes} />
            <Metric label="Pop ops" value={trace.queue.pops} />
            <Metric label="Sift swaps" value={trace.queue.swaps} accent="#22d3ee" />
          </>
        )}
      </div>

      <div className={`grid gap-4 ${after ? "lg:grid-cols-[1fr_auto_1fr]" : ""}`}>
        {/* before */}
        <div>
          <SectionTitle
            icon={<ListOrdered className="w-3.5 h-3.5" />}
            title={trace ? "Heap state · before extract-min" : "Live heap state · pop order"}
          />
          <div className="flex flex-col gap-1.5">
            {before.map((q, i) => (
              <div key={`${q.vehicleId}-${i}`} className={`qrow flex items-center gap-2.5 px-3 py-2 ${i === 0 ? "head" : ""}`}>
                <span className="font-mono2 text-[10px] w-5 text-[#4b586e]">#{i + 1}</span>
                <PlateChip plate={q.licensePlate} />
                <SizeGlyph size={q.vehicleSize} className="w-4 h-4 text-[#7d8aa0]" />
                <span className="flex-1" />
                <PriorityChip level={q.priorityLevel} />
                <span className="font-mono2 text-[9.5px] text-[#4b586e] w-[62px] text-right">{fmtTime(q.arrivalTime)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* extraction marker */}
        {after && trace && (
          <div className="flex lg:flex-col items-center justify-center gap-2 text-[#a78bfa]">
            <ArrowDownToLine className="w-4 h-4 hidden lg:block" />
            <ArrowRight className="w-4 h-4 lg:hidden" />
            <span className="font-mono2 text-[8.5px] tracking-[0.2em] [writing-mode:vertical-rl] hidden lg:block">
              EXTRACT-MIN
            </span>
          </div>
        )}

        {/* after */}
        {after && (
          <div>
            <SectionTitle icon={<GitCompareArrows className="w-3.5 h-3.5" />} title="Heap state · after sift-down repair" />
            {after.length === 0 ? (
              <EmptyState label="Heap drained" sub="Every queued vehicle was served." />
            ) : (
              <div className="flex flex-col gap-1.5">
                {after.map((q, i) => (
                  <div key={`${q.vehicleId}-a${i}`} className={`qrow flex items-center gap-2.5 px-3 py-2 ${i === 0 ? "head" : ""}`}>
                    <span className="font-mono2 text-[10px] w-5 text-[#4b586e]">#{i + 1}</span>
                    <PlateChip plate={q.licensePlate} />
                    <SizeGlyph size={q.vehicleSize} className="w-4 h-4 text-[#7d8aa0]" />
                    <span className="flex-1" />
                    <PriorityChip level={q.priorityLevel} />
                    <span className="font-mono2 text-[9.5px] text-[#4b586e] w-[62px] text-right">{fmtTime(q.arrivalTime)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="font-mono2 text-[10px] leading-relaxed text-[#4b586e] border-t border-[#141b28] pt-3">
        HEAP INVARIANT — parent ≼ children under key (priorityLevel, arrivalTime). Extracted head:{" "}
        {trace ? (
          <span className="text-[#a78bfa]">
            {trace.queue.before[0]?.licensePlate} · {priorityLabel(trace.queue.before[0]?.priorityLevel ?? 3)}
          </span>
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* TAB 2 — BINARY SEARCH (animated replay)                            */
/* ================================================================== */
function SearchPanel({ trace }: { trace: AllocationTrace | null }) {
  const steps = trace?.search.steps ?? [];
  const [cursor, setCursor] = useState(0); // how many steps executed
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const traceKey = trace ? trace.search.vehicle.vehicleId + ":" + trace.search.comparisons + ":" + trace.search.resultIndex + ":" + trace.queue.pops + ":" + (trace.search.vehicle.arrivalTime ?? "") : "none";

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  };
  const play = (from: number) => {
    stop();
    if (steps.length === 0) return;
    setPlaying(true);
    let c = from;
    timerRef.current = setInterval(() => {
      c += 1;
      setCursor(c);
      if (c >= steps.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setPlaying(false);
      }
    }, 1050);
  };

  // restart animation whenever a new trace arrives
  const prevKey = useRef<string>("");
  useEffect(() => {
    if (traceKey !== prevKey.current) {
      prevKey.current = traceKey;
      setCursor(0);
      play(0);
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traceKey]);

  const done = cursor >= steps.length;
  const current = cursor > 0 ? steps[cursor - 1] : null;

  const chipState = useMemo(() => {
    const m = new Map<number, "mid" | "discarded" | "answer">();
    if (!trace) return m;
    if (current) {
      for (let i = 0; i < trace.search.probedArray.length; i++) {
        if (i < current.low || i > current.high) m.set(i, "discarded");
      }
      m.set(current.mid, "mid");
    }
    if (done && trace.search.resultIndex >= 0) m.set(trace.search.resultIndex, "answer");
    return m;
  }, [current, done, trace]);

  if (!trace)
    return (
      <EmptyState
        label="No search executed yet"
        sub="Allocate a vehicle — the live low / mid / high pointer sweep over the distance-sorted free-slot array will replay here."
      />
    );

  const s = trace.search;

  return (
    <div className="anim-fadeUp flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6">
          <Metric label="Comparisons" value={s.comparisons} accent="#fbbf24" />
          <Metric label="Array size" value={s.slotsScanned} />
          <Metric
            label="Brute-force would cost"
            value={s.slotsScanned}
            accent="#fb4d6d"
          />
          <Metric label="Result idx" value={s.resultIndex >= 0 ? `#${s.resultIndex}` : "∅"} accent="#34d399" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono2 text-[10px] text-[#4b586e] mr-1">
            STEP {Math.min(cursor, s.steps.length)}/{s.steps.length}
          </span>
          {!playing ? (
            <button className="btn btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={() => play(cursor >= steps.length ? 0 : cursor)} disabled={steps.length === 0}>
              {cursor === 0 ? <Play className="w-3 h-3" /> : cursor >= steps.length ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {cursor >= steps.length ? "Replay" : cursor === 0 ? "Play" : "Resume"}
            </button>
          ) : (
            <button className="btn btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={stop}>
              Pause
            </button>
          )}
          <button
            className="btn btn-ghost !py-1.5 !px-3 !text-[11px]"
            onClick={() => {
              stop();
              setCursor(steps.length);
            }}
            disabled={steps.length === 0}
          >
            Skip
          </button>
        </div>
      </div>

      {/* context line */}
      <div className="flex items-center gap-2 flex-wrap font-mono2 text-[10.5px] text-[#7d8aa0]">
        <Braces className="w-3.5 h-3.5 text-[#4b586e]" />
        free slots sorted by <span className="text-[#22d3ee]">distance ASC</span> · target: first index where a slot fits{" "}
        <span className="text-[#e6edf6] font-bold">{s.vehicle.vehicleSize}</span> (rank ≥ {s.requiredRank}) · predicate P(i) monotone
      </div>

      {/* the array */}
      {s.probedArray.length === 0 ? (
        <EmptyState label="Zero free slots" sub="The lot is fully occupied — nothing to binary-search." />
      ) : (
        <div className="flex flex-wrap gap-2 pt-3 pb-1">
          {s.probedArray.map((p, i) => {
            const st = chipState.get(i);
            return (
              <div
                key={p.id}
                className={[
                  "bs-chip",
                  p.fits ? "fit" : "no-fit",
                  st === "discarded" ? "discarded" : "",
                  st === "mid" ? "is-mid" : "",
                  st === "answer" ? "is-answer" : "",
                ].join(" ")}
              >
                {current && current.low === i && <span className="ptr-tag ptr-low">LOW</span>}
                {current && current.high === i && <span className="ptr-tag ptr-high">HIGH</span>}
                {current && current.mid === i && <span className="ptr-tag ptr-mid">MID</span>}
                <div className="flex items-center justify-center gap-1">
                  <span className="fit-dot" />
                  <span className="font-mono2 text-[11px] font-bold">{p.slotNumber}</span>
                </div>
                <div className="font-mono2 text-[9px] text-[#4b586e] mt-0.5">
                  #{i} · {p.distance}m
                </div>
                <div className="font-mono2 text-[8.5px] tracking-wider mt-0.5" style={{ color: p.fits ? "#34d399" : "#39445a" }}>
                  {SIZE_SHORT[p.size]}{p.fits ? " ✓" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* narrator */}
      <div className="rounded-xl border border-[#1a2230] bg-[#0a0e15] px-4 py-3 min-h-[64px]">
        <div className="micro-label !text-[9px] mb-1">STEP NARRATOR</div>
        {current ? (
          <p key={current.step} className="step-narrative font-mono2 text-[11.5px] leading-relaxed text-[#c8d4e8]">
            <span className="text-[#fbbf24]">[{current.step}]</span> low={current.low} high={current.high} → mid=
            <span className="text-[#fbbf24]">{current.mid}</span> · {current.narrative}
          </p>
        ) : done || steps.length === 0 ? (
          <p className="font-mono2 text-[11.5px] leading-relaxed text-[#c8d4e8]">
            {s.resultIndex >= 0 ? (
              <>
                <span className="text-[#34d399]">CONVERGED</span> — first fitting index = #{s.resultIndex} (
                {s.chosen?.slotNumber}, {s.chosen?.distance}m) in {s.comparisons} comparisons vs {s.slotsScanned} for a linear scan.
              </>
            ) : (
              <>
                <span className="text-[#fb4d6d]">EXHAUSTED</span> — search space collapsed (low &gt; high). No free slot fits a{" "}
                {s.vehicle.vehicleSize} vehicle.
              </>
            )}
          </p>
        ) : (
          <p className="font-mono2 text-[11.5px] text-[#4b586e]">Press play to step the search…</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* TAB 3 — GREEDY RATIONALE                                           */
/* ================================================================== */
function GreedyPanel({ trace }: { trace: AllocationTrace | null }) {
  if (!trace)
    return (
      <EmptyState label="No decision committed yet" sub="The greedy rationale for the chosen slot — and the rejected alternatives — will appear here." />
    );
  const s = trace.search;
  return (
    <div className="anim-fadeUp flex flex-col gap-4">
      <div className="rounded-xl border border-[#fbbf2433] bg-[rgba(251,191,36,.04)] px-4 py-3">
        <div className="micro-label !text-[9px] !text-[#fbbf24] mb-1">SELECTION RULE</div>
        <p className="font-mono2 text-[11px] leading-relaxed text-[#e8d9b0]">{s.greedy.rule}</p>
      </div>

      {s.chosen ? (
        <>
          <div className="grid sm:grid-cols-[1fr_1.2fr] gap-3">
            {/* chosen */}
            <div className="rounded-xl border border-[#34d39955] bg-[rgba(52,211,153,.05)] p-4">
              <div className="micro-label !text-[9px] !text-[#34d399] mb-2">COMMITTED CHOICE</div>
              <div className="flex items-center gap-3">
                <span className="font-mono2 text-3xl font-bold text-[#34d399]">{s.chosen.slotNumber}</span>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[#c8d4e8] text-xs font-semibold">
                    <SizeGlyph size={s.chosen.size} className="w-4 h-4" /> {s.chosen.size} bay
                  </span>
                  <span className="font-mono2 text-[10px] text-[#7d8aa0] flex items-center gap-1">
                    <Footprints className="w-3 h-3" /> {s.chosen.distance}m from gate · zone {s.chosen.zone}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#34d39922] font-mono2 text-[10px] text-[#7d8aa0]">
                for <span className="text-[#e6edf6]">{s.vehicle.licensePlate}</span> · {s.vehicle.vehicleSize} vehicle · rank {SIZE_RANK[s.vehicle.vehicleSize]} ≤ slot rank {SIZE_RANK[s.chosen.size]}
              </div>
            </div>

            {/* alternatives */}
            <div className="rounded-xl border border-[#1a2230] bg-[#0a0e15] p-4">
              <div className="micro-label !text-[9px] mb-2">REJECTED FEASIBLE ALTERNATIVES</div>
              {s.alternatives.length === 0 ? (
                <p className="font-mono2 text-[10.5px] text-[#4b586e] pt-2">No other free slot can fit this vehicle. Choice forced — still optimal.</p>
              ) : (
                <div className="flex flex-col gap-1.5 pt-1">
                  {s.alternatives.map((a) => (
                    <div key={a.slot.id} className="flex items-center gap-3 font-mono2 text-[11px] text-[#7d8aa0]">
                      <span className="text-[#c8d4e8] font-bold w-8">{a.slot.slotNumber}</span>
                      <SizeGlyph size={a.slot.size} className="w-3.5 h-3.5" />
                      <span className="text-[9.5px]">{a.slot.distance}m</span>
                      <span className="flex-1" />
                      <span className="text-[#fb4d6d] text-[10px]">+{a.deltaMeters}m farther — rejected</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="micro-label !text-[9px] mb-1.5">WHY THIS MINIMIZES TRAVEL DISTANCE</div>
            <p className="text-[12.5px] leading-relaxed text-[#aab8cc]">{s.greedy.explanation}</p>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-[#fb4d6d44] bg-[rgba(251,77,109,.05)] p-4">
          <div className="micro-label !text-[9px] !text-[#fb4d6d] mb-1">NO FEASIBLE CHOICE</div>
          <p className="text-[12.5px] leading-relaxed text-[#e8b4be]">{s.greedy.explanation}</p>
        </div>
      )}
    </div>
  );
}

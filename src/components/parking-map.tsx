"use client";

import { useMemo } from "react";
import { DoorOpen, LogOut, MousePointerClick, CircleDot } from "lucide-react";
import type { SlotDto } from "@/lib/dto";
import { SizeGlyph, SIZE_COLOR } from "./bits";

const ZONE_TITLE: Record<string, string> = {
  K: "BIKE RING",
  A: "NEAR FIELD",
  B: "MID FIELD",
  C: "FAR FIELD",
  D: "OVERFLOW",
};

interface Zone {
  key: string;
  slots: SlotDto[];
  dmin: number;
  dmax: number;
  free: number;
  isBike: boolean;
}

export default function ParkingMap({
  slots,
  hotSlotId,
  releasingId,
  onRelease,
  waitingCount,
}: {
  slots: SlotDto[];
  hotSlotId: number | null;
  releasingId: number | null;
  onRelease: (id: number) => void;
  waitingCount: number;
}) {
  const zones = useMemo<Zone[]>(() => {
    const byZone = new Map<string, SlotDto[]>();
    for (const s of slots) {
      const arr = byZone.get(s.zone) ?? [];
      arr.push(s);
      byZone.set(s.zone, arr);
    }
    return [...byZone.entries()]
      .map(([key, zs]) => ({
        key,
        slots: zs,
        dmin: Math.min(...zs.map((s) => s.distance)),
        dmax: Math.max(...zs.map((s) => s.distance)),
        free: zs.filter((s) => !s.isOccupied).length,
        isBike: zs.every((s) => s.size === "Bike"),
      }))
      .sort((a, b) => a.dmin - b.dmin);
  }, [slots]);

  const bikeZone = zones.find((z) => z.isBike);
  const carZones = zones.filter((z) => !z.isBike);
  const maxDist = Math.max(1, ...slots.map((s) => s.distance));
  const rulerMax = Math.ceil((maxDist + 5) / 25) * 25;
  const rulerTicks = Array.from({ length: rulerMax / 25 + 1 }, (_, i) => i * 25);

  const card = (s: SlotDto, compact: boolean) => {
    const state = s.id === hotSlotId ? "is-hot" : s.isOccupied ? "is-occupied" : "is-free";
    return (
      <div
        key={s.id}
        className={`slot-card ${compact ? "!p-2" : ""} ${state} ${s.id === releasingId ? "is-releasing" : ""}`}
        onClick={() => s.isOccupied && s.id !== releasingId && onRelease(s.id)}
        title={
          s.isOccupied
            ? `${s.occupiedByPlate} · click to release`
            : `Free ${s.size} slot · ${s.distance}m from gate`
        }
      >
        <div className="flex items-center justify-between">
          <span className={`font-mono2 font-bold ${compact ? "text-[11px]" : "text-[13px]"}`}>{s.slotNumber}</span>
          <span style={{ color: SIZE_COLOR[s.size] }}>
            <SizeGlyph size={s.size} className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
          </span>
        </div>
        {s.isOccupied ? (
          <div className="mt-1 flex items-center justify-between gap-1">
            <span className={`font-mono2 text-[#e6a2b0] truncate ${compact ? "text-[8.5px]" : "text-[9.5px]"}`}>
              {s.occupiedByPlate}
            </span>
            <LogOut className="w-3 h-3 text-[#fb4d6d88] shrink-0" />
          </div>
        ) : (
          <div className={`mt-1 font-mono2 tracking-[0.18em] text-[#34d399] ${compact ? "text-[8.5px]" : "text-[9.5px]"}`}>
            {s.id === hotSlotId ? "ASSIGNED" : "FREE"}
          </div>
        )}
        <div className={`flex items-center gap-1.5 ${compact ? "mt-1.5" : "mt-2"}`}>
          <div className="dist-bar flex-1">
            <i style={{ width: `${(s.distance / maxDist) * 100}%` }} />
          </div>
          <span className="font-mono2 text-[9px] text-[#4b586e]">{s.distance}m</span>
        </div>
      </div>
    );
  };

  const zoneHeader = (z: Zone) => (
    <div className="flex items-baseline justify-between px-1" key={`h-${z.key}`}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono2 text-sm font-bold text-[#e6edf6]">ZONE {z.key}</span>
        <span className="micro-label !text-[9px]">{ZONE_TITLE[z.key] ?? z.key}</span>
      </div>
      <span className="font-mono2 text-[10px] text-[#4b586e]">
        {z.dmin}–{z.dmax}m · <span className="text-[#34d399]">{z.free} free</span>
      </span>
    </div>
  );

  return (
    <div className="panel p-5 relative z-10">
      <div className="flex items-stretch gap-4">
        {/* ------------- entrance strip ------------- */}
        <div className="flex flex-col items-center justify-between py-2 px-2 rounded-xl border border-dashed border-[#2a3a58] bg-[rgba(52,211,153,.03)] min-w-[64px]">
          <span className="micro-label !text-[9px] [writing-mode:vertical-rl] rotate-180 tracking-[0.35em]">
            ENTRANCE · GATE 0m
          </span>
          <div className="flex flex-col items-center gap-1.5">
            {waitingCount > 0 && (
              <span className="font-mono2 text-[10px] font-bold text-[#a78bfa] bg-[rgba(167,139,250,.1)] border border-[#a78bfa55] rounded-md px-1.5 py-0.5 whitespace-nowrap">
                {waitingCount} IN QUEUE
              </span>
            )}
            <DoorOpen className="w-5 h-5 text-[#34d399]" />
          </div>
          <div className="w-px h-8 bg-gradient-to-b from-[#34d39966] to-transparent" />
        </div>

        {/* ------------- zones ------------- */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {/* bike ring */}
          {bikeZone && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between px-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono2 text-sm font-bold text-[#2dd4bf]">ZONE {bikeZone.key}</span>
                  <span className="micro-label !text-[9px] !text-[#2dd4bf99] flex items-center gap-1">
                    <CircleDot className="w-2.5 h-2.5" /> BIKE RING · RACK ROW
                  </span>
                </div>
                <span className="font-mono2 text-[10px] text-[#4b586e]">
                  {bikeZone.dmin}–{bikeZone.dmax}m · <span className="text-[#34d399]">{bikeZone.free} free</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">{bikeZone.slots.map((s) => (
                <div key={s.id} className="w-[86px]">{card(s, true)}</div>
              ))}</div>
            </div>
          )}

          {/* car zones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-x-4 gap-y-5">
            {carZones.map((zone) => (
              <div key={zone.key} className="flex flex-col gap-2.5">
                {zoneHeader(zone)}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 relative">
                  <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 border-l border-dashed border-[#1f2a3f]" />
                  {zone.slots.map((s) => card(s, false))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------- distance ruler ------------- */}
      <div className="mt-4 flex items-center gap-3">
        <div className="ruler flex-1">
          {rulerTicks.map((t) => (
            <span key={t}>
              <i className="tick" style={{ left: `${(t / rulerMax) * 100}%` }} />
              <span className="tick-label" style={{ left: `${(t / rulerMax) * 100}%` }}>
                {t % 50 === 0 ? `${t}m` : ""}
              </span>
            </span>
          ))}
        </div>
        <span className="micro-label !text-[9px] flex items-center gap-1.5 shrink-0">
          <MousePointerClick className="w-3 h-3" /> click an occupied slot to release it
        </span>
      </div>
    </div>
  );
}

"use client";

import { Car, Bus, Truck, Bike, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import type { VehicleSize } from "@/lib/dto";

export function SizeGlyph({ size, className = "w-4 h-4" }: { size: VehicleSize; className?: string }) {
  if (size === "Large") return <Truck className={className} />;
  if (size === "Medium") return <Bus className={className} />;
  if (size === "Bike") return <Bike className={className} />;
  return <Car className={className} />;
}

export const SIZE_COLOR: Record<VehicleSize, string> = {
  Bike: "#2dd4bf",
  Small: "#7dd3fc",
  Medium: "#a78bfa",
  Large: "#fb923c",
};

export function PriorityChip({ level }: { level: number }) {
  const map: Record<number, { label: string; color: string; bg: string }> = {
    1: { label: "P1 · EMERG", color: "#fb4d6d", bg: "rgba(251,77,109,.1)" },
    2: { label: "P2 · VIP", color: "#fbbf24", bg: "rgba(251,191,36,.1)" },
    3: { label: "P3 · STD", color: "#7d8aa0", bg: "rgba(125,138,160,.1)" },
  };
  const m = map[level] ?? map[3];
  return (
    <span
      className="font-mono2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md border"
      style={{ color: m.color, background: m.bg, borderColor: `${m.color}55` }}
    >
      {m.label}
    </span>
  );
}

export function SectionTitle({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[#7d8aa0]">{icon}</span>
        <h2 className="micro-label !text-[11px]">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="w-6 h-6 text-[#39445a]" />
      <div className="text-sm text-[#7d8aa0] font-medium">{label}</div>
      {sub && <div className="text-xs text-[#4b586e] max-w-[260px]">{sub}</div>}
    </div>
  );
}

export function ResultChip({ result, slotNumber }: { result: string; slotNumber?: string | null }) {
  if (result === "ALLOCATED")
    return (
      <span className="font-mono2 text-[10px] font-bold px-2 py-0.5 rounded-md border text-[#34d399] bg-[rgba(52,211,153,.09)] border-[#34d39955]">
        → SLOT {slotNumber}
      </span>
    );
  if (result === "WAITING")
    return (
      <span className="font-mono2 text-[10px] font-bold px-2 py-0.5 rounded-md border text-[#fbbf24] bg-[rgba(251,191,36,.09)] border-[#fbbf2455]">
        WAITING
      </span>
    );
  return (
    <span className="font-mono2 text-[10px] font-bold px-2 py-0.5 rounded-md border text-[#fb4d6d] bg-[rgba(251,77,109,.09)] border-[#fb4d6d55]">
      RELEASED {slotNumber}
    </span>
  );
}

export function Metric({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="micro-label !text-[9px]">{label}</span>
      <span className="font-mono2 text-xl font-bold leading-none" style={{ color: accent ?? "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function PlateChip({ plate }: { plate: string }) {
  return (
    <span className="font-mono2 text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-md bg-[#0a0e15] border border-[#26334a] text-[#c8d4e8]">
      {plate}
    </span>
  );
}

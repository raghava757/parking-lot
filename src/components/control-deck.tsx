"use client";

import {
  Zap,
  ListPlus,
  Play,
  FastForward,
  Dices,
  Eraser,
  RotateCcw,
  TerminalSquare,
  Flame,
  Crown,
  CircleParking,
} from "lucide-react";
import { useState } from "react";
import type { VehicleSize } from "@/lib/dto";
import { SizeGlyph, SIZE_COLOR } from "./bits";

const PRIORITIES = [
  { v: 1, label: "Emergency", icon: Flame, color: "#fb4d6d" },
  { v: 2, label: "VIP", icon: Crown, color: "#fbbf24" },
  { v: 3, label: "Standard", icon: CircleParking, color: "#7d8aa0" },
];

export default function ControlDeck({
  busy,
  onRequestAllocate,
  onQueueOnly,
  onProcess,
  onSimulateRush,
  onClearQueue,
  onReset,
}: {
  busy: boolean;
  onRequestAllocate: (size: VehicleSize, priority: number, plate: string) => void;
  onQueueOnly: (size: VehicleSize, priority: number, plate: string) => void;
  onProcess: (mode: "next" | "all") => void;
  onSimulateRush: () => void;
  onClearQueue: () => void;
  onReset: () => void;
}) {
  const [size, setSize] = useState<VehicleSize>("Medium");
  const [priority, setPriority] = useState(3);
  const [plate, setPlate] = useState("");

  return (
    <div className="panel p-5 z-10">
      <div className="flex items-center gap-2.5 mb-4">
        <TerminalSquare className="w-4 h-4 text-[#7d8aa0]" />
        <h2 className="micro-label !text-[11px]">CONTROL DECK</h2>
      </div>

      {/* vehicle intake */}
      <div className="mb-2 micro-label !text-[9px] !text-[#4b586e]">VEHICLE INTAKE</div>
      <div className="flex flex-col gap-2.5">
        <div className="seg">
          {(["Bike", "Small", "Medium", "Large"] as VehicleSize[]).map((s) => (
            <button key={s} className={size === s ? "on" : ""} onClick={() => setSize(s)}>
              <span style={{ color: size === s ? SIZE_COLOR[s] : undefined }}>
                <SizeGlyph size={s} className="w-4 h-4" />
              </span>
              {s}
            </button>
          ))}
        </div>
        <div className="seg">
          {PRIORITIES.map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.v} className={priority === p.v ? "on" : ""} onClick={() => setPriority(p.v)}>
                <Icon className="w-3.5 h-3.5" style={{ color: priority === p.v ? p.color : undefined }} />
                {p.label}
              </button>
            );
          })}
        </div>
        <input
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase().slice(0, 12))}
          placeholder="LICENSE PLATE (optional — auto)"
          className="font-mono2 text-xs bg-[#0a0e15] border border-[#1a2230] rounded-xl px-3.5 py-2.5 tracking-widest placeholder:text-[#39445a] placeholder:tracking-[0.2em] focus:outline-none focus:border-[#2c3c58] transition-colors"
        />
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1 justify-center" disabled={busy} onClick={() => onRequestAllocate(size, priority, plate.trim())}>
            <Zap className="w-4 h-4" /> Request &amp; Allocate
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => { onQueueOnly(size, priority, plate.trim()); setPlate(""); }} title="Push onto the priority queue without serving">
            <ListPlus className="w-4 h-4" /> Queue
          </button>
        </div>
      </div>

      {/* queue ops */}
      <div className="mt-5 mb-2 micro-label !text-[9px] !text-[#4b586e]">QUEUE OPERATIONS</div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-violet justify-center !px-2" disabled={busy} onClick={() => onProcess("next")}>
          <Play className="w-3.5 h-3.5" /> Process next
        </button>
        <button className="btn btn-violet justify-center !px-2" disabled={busy} onClick={() => onProcess("all")}>
          <FastForward className="w-3.5 h-3.5" /> Process all
        </button>
        <button className="btn btn-ghost justify-center !px-2" disabled={busy} onClick={onSimulateRush}>
          <Dices className="w-3.5 h-3.5" /> Simulate rush ×6
        </button>
        <button className="btn btn-ghost justify-center !px-2" disabled={busy} onClick={onClearQueue}>
          <Eraser className="w-3.5 h-3.5" /> Clear queue
        </button>
      </div>

      <button className="btn btn-danger w-full justify-center mt-2" disabled={busy} onClick={onReset}>
        <RotateCcw className="w-3.5 h-3.5" /> Reset entire lot
      </button>

      {/* complexity legend */}
      <div className="mt-5 pt-4 border-t border-[#141b28]">
        <div className="micro-label !text-[9px] !text-[#4b586e] mb-2.5">PIPELINE COMPLEXITY</div>
        <div className="flex flex-col gap-1.5 font-mono2 text-[10.5px]">
          {[
            ["PUSH / EXTRACT-MIN", "binary heap", "O(log n)"],
            ["NEAREST-FIT BOUND", "binary search", "O(log n)"],
            ["LOCAL OPTIMUM PICK", "greedy rule", "O(1)"],
          ].map(([a, b, c]) => (
            <div key={a} className="flex items-center justify-between gap-2">
              <span className="text-[#7d8aa0]">{a}</span>
              <span className="text-[#4b586e] hidden xl:inline">{b}</span>
              <span className="text-[#34d399]">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

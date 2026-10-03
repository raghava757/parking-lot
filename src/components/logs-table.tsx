"use client";

import { ScrollText, ChevronRight } from "lucide-react";
import type { LogDto } from "@/lib/dto";
import { EmptyState, PlateChip, PriorityChip, ResultChip, SectionTitle, SizeGlyph, fmtTime } from "./bits";

export default function LogsTable({
  logs,
  activeLogId,
  onInspect,
}: {
  logs: LogDto[];
  activeLogId: number | null;
  onInspect: (log: LogDto) => void;
}) {
  return (
    <div className="panel p-5 z-10">
      <SectionTitle
        icon={<ScrollText className="w-4 h-4" />}
        title="ALLOCATION LOG · PERSISTED DECISION HISTORY"
        right={<span className="font-mono2 text-[10px] text-[#4b586e]">{logs.length} ENTRIES · click a row to replay its trace</span>}
      />
      {logs.length === 0 ? (
        <EmptyState label="No decisions logged yet" sub="Every heap extraction, binary search and greedy commitment is persisted here with its metrics." />
      ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-[#141b28]">
                {["TIME", "PLATE", "VEHICLE", "PRIORITY", "RESULT", "CMP", "HEAP OPS", "SCANNED", ""].map((h, i) => (
                  <th key={i} className="micro-label !text-[9px] font-normal py-2 pr-4 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr
                  key={l.id}
                  className={`logrow border-b border-[#10151f] ${l.id === activeLogId ? "active" : ""}`}
                  onClick={() => l.trace && onInspect(l)}
                  title={l.trace ? "Replay this decision in the inspector" : "No trace (release event)"}
                >
                  <td className="py-2.5 pr-4 font-mono2 text-[11px] text-[#7d8aa0] whitespace-nowrap">{fmtTime(l.createdAt)}</td>
                  <td className="py-2.5 pr-4"><PlateChip plate={l.licensePlate} /></td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-1.5 text-[11px] text-[#c8d4e8]">
                      <SizeGlyph size={l.vehicleSize} className="w-3.5 h-3.5 text-[#7d8aa0]" />
                      {l.vehicleSize}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4"><PriorityChip level={l.priorityLevel} /></td>
                  <td className="py-2.5 pr-4"><ResultChip result={l.result} slotNumber={l.slotNumber} /></td>
                  <td className="py-2.5 pr-4 font-mono2 text-[12px] font-bold text-[#fbbf24]">
                    {l.result === "RELEASED" ? "—" : l.comparisons}
                  </td>
                  <td className="py-2.5 pr-4 font-mono2 text-[11px] text-[#a78bfa]">
                    {l.result === "RELEASED" ? "—" : l.heapOps}
                  </td>
                  <td className="py-2.5 pr-4 font-mono2 text-[11px] text-[#7d8aa0]">
                    {l.result === "RELEASED" ? "—" : l.slotsScanned}
                  </td>
                  <td className="py-2.5">
                    {l.trace && <ChevronRight className="w-3.5 h-3.5 text-[#39445a]" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

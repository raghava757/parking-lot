/* Shared DTO shapes between API routes and the React client */
import type { AllocationTrace, QueueItem, VehicleSize } from "./allocator";

export type { AllocationTrace, QueueItem, VehicleSize };

export interface SlotDto {
  id: number;
  slotNumber: string;
  size: VehicleSize;
  distance: number;
  zone: string;
  isOccupied: boolean;
  occupiedByPlate: string | null;
}

export interface SlotsResponse {
  slots: SlotDto[];
  stats: {
    total: number;
    occupied: number;
    free: number;
    occupancyRate: number;
    freeBySize: Record<VehicleSize, number>;
    queueLength: number;
    nextUp: QueueItem | null;
  };
}

export interface ServePayload {
  submitted?: QueueItem;
  headOfLineBlocking?: boolean;
  served: QueueItem;
  result: "ALLOCATED" | "WAITING";
  assignedSlot: { id: number; slotNumber: string; size: VehicleSize; distance: number; zone: string } | null;
  trace: AllocationTrace;
  logId: number;
  note: string;
}

export interface ProcessResponse {
  processed: number;
  results: ServePayload[];
  blocked: boolean;
  remaining: number;
  message: string;
}

export interface LogDto {
  id: number;
  vehicleId: number | null;
  licensePlate: string;
  vehicleSize: VehicleSize;
  priorityLevel: number;
  slotId: number | null;
  slotNumber: string | null;
  result: "ALLOCATED" | "WAITING" | "RELEASED";
  comparisons: number;
  heapOps: number;
  slotsScanned: number;
  explanation: string;
  trace: AllocationTrace | null;
  createdAt: string;
}

export interface QueueResponse {
  size: number;
  popOrder: QueueItem[];
  heapOps: { pushes: number; swaps: number };
}

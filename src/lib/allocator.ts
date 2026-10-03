/* ================================================================== */
/*  ALGORITHMIC ENGINE — instrumented for full transparency            */
/*  1. Binary Min-Heap   (priority queue: urgency, then FIFO)          */
/*  2. Binary Search     (nearest-fit bound on distance-sorted slots)  */
/*  3. Greedy Strategy   (minimum-distance feasible slot selection)    */
/* ================================================================== */

export type VehicleSize = "Bike" | "Small" | "Medium" | "Large";
export const SIZE_RANK: Record<VehicleSize, number> = {
  Bike: 0,
  Small: 1,
  Medium: 2,
  Large: 3,
};
export const SIZE_SHORT: Record<VehicleSize, string> = {
  Bike: "BIKE",
  Small: "S",
  Medium: "M",
  Large: "L",
};

export interface QueueItem {
  vehicleId: number;
  licensePlate: string;
  vehicleSize: VehicleSize;
  priorityLevel: number;
  arrivalTime: string; // ISO
}

/* ------------------------------------------------------------------ */
/* 1 ▸ PRIORITY QUEUE — binary min-heap ordered by                     */
/*     (priorityLevel ASC, arrivalTime ASC, vehicleId ASC)             */
/*     Every sift swap is counted so heap maintenance cost is visible. */
/* ------------------------------------------------------------------ */
export class MinHeap {
  private items: QueueItem[] = [];
  swaps = 0;
  pushes = 0;
  pops = 0;

  get size(): number {
    return this.items.length;
  }

  private static less(a: QueueItem, b: QueueItem): boolean {
    if (a.priorityLevel !== b.priorityLevel)
      return a.priorityLevel < b.priorityLevel;
    const t = Date.parse(a.arrivalTime) - Date.parse(b.arrivalTime);
    if (t !== 0) return t < 0;
    return a.vehicleId - b.vehicleId < 0;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (MinHeap.less(this.items[i], this.items[parent])) {
        [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
        this.swaps++;
        i = parent;
      } else break;
    }
  }

  private siftDown(i: number): void {
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < n && MinHeap.less(this.items[l], this.items[smallest])) smallest = l;
      if (r < n && MinHeap.less(this.items[r], this.items[smallest])) smallest = r;
      if (smallest === i) break;
      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      this.swaps++;
      i = smallest;
    }
  }

  push(item: QueueItem): void {
    this.items.push(item);
    this.pushes++;
    this.siftUp(this.items.length - 1);
  }

  pop(): QueueItem | undefined {
    if (this.items.length === 0) return undefined;
    this.pops++;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  peek(): QueueItem | undefined {
    return this.items[0];
  }

  /** Exact drain order without mutating the live heap. */
  popOrder(): QueueItem[] {
    const clone = new MinHeap();
    for (const it of this.items) clone.push(it);
    const order: QueueItem[] = [];
    let cur: QueueItem | undefined;
    while ((cur = clone.pop())) order.push(cur);
    return order;
  }
}

/* ------------------------------------------------------------------ */
/* 2+3 ▸ BINARY SEARCH + GREEDY                                        */
/*                                                                     */
/* Free slots are kept sorted ascending by distance_from_entrance.     */
/* Predicate P(i) = "a slot able to fit the vehicle exists at an      */
/* index ≤ i". P is monotone (false … false true … true), so a binary  */
/* search for the FIRST true index yields exactly the NEAREST fitting  */
/* slot — the greedy optimum. prefixFit[] makes each probe O(1).       */
/* ------------------------------------------------------------------ */

export interface SlotCandidate {
  id: number;
  slotNumber: string;
  size: VehicleSize;
  distance: number;
  zone: string;
}

export interface ProbedSlot extends SlotCandidate {
  fits: boolean;
}

export interface BinarySearchStep {
  step: number;
  low: number;
  high: number;
  mid: number;
  midSlot: SlotCandidate & { fits: boolean };
  prefixHit: boolean; // P(mid): does a fitting slot exist at index ≤ mid?
  discarded: "LEFT_HALF" | "RIGHT_HALF";
  narrative: string;
}

export interface GreedyAlternative {
  slot: SlotCandidate;
  deltaMeters: number;
}

export interface SearchTrace {
  vehicle: QueueItem;
  requiredRank: number;
  probedArray: ProbedSlot[]; // free slots sorted by distance
  steps: BinarySearchStep[];
  comparisons: number;
  slotsScanned: number; // prefix-fit single linear pass
  resultIndex: number; // -1 when nothing fits
  chosen: SlotCandidate | null;
  alternatives: GreedyAlternative[];
  greedy: { explanation: string; rule: string };
}

export function nearestFitSearch(
  freeSorted: SlotCandidate[],
  vehicle: QueueItem,
): SearchTrace {
  const required = SIZE_RANK[vehicle.vehicleSize];
  const probed: ProbedSlot[] = freeSorted.map((s) => ({
    ...s,
    fits: SIZE_RANK[s.size] >= required,
  }));

  /* O(1) monotone predicate support: one linear scan builds prefixFit */
  const prefixFit: boolean[] = new Array(probed.length).fill(false);
  let seen = false;
  for (let i = 0; i < probed.length; i++) {
    seen = seen || probed[i].fits;
    prefixFit[i] = seen;
  }

  const steps: BinarySearchStep[] = [];
  let comparisons = 0;
  let low = 0;
  let high = probed.length - 1;
  let ans = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    comparisons++;
    const hit = prefixFit[mid];
    const s = probed[mid];
    if (hit) {
      ans = mid;
      steps.push({
        step: steps.length + 1,
        low,
        high,
        mid,
        midSlot: { id: s.id, slotNumber: s.slotNumber, size: s.size, distance: s.distance, zone: s.zone, fits: s.fits },
        prefixHit: true,
        discarded: "RIGHT_HALF",
        narrative: `P(mid)=true — a fitting slot exists at index ≤ ${mid} (${s.slotNumber}, ${s.distance}m). Best answer so far = ${mid}; contract right bound: high = ${mid - 1}.`,
      });
      high = mid - 1;
    } else {
      steps.push({
        step: steps.length + 1,
        low,
        high,
        mid,
        midSlot: { id: s.id, slotNumber: s.slotNumber, size: s.size, distance: s.distance, zone: s.zone, fits: s.fits },
        prefixHit: false,
        discarded: "LEFT_HALF",
        narrative: `P(mid)=false — no slot in [${low}..${mid}] fits a ${vehicle.vehicleSize} vehicle (nearest candidate ${s.slotNumber} is ${s.size}). Discard left half: low = ${mid + 1}.`,
      });
      low = mid + 1;
    }
  }

  let chosen: SlotCandidate | null = null;
  let alternatives: GreedyAlternative[] = [];
  let explanation = "";
  const rule =
    "GREEDY RULE — pick the feasible slot with the minimum distance_from_entrance; never look ahead, always take the locally optimal choice.";

  if (ans >= 0) {
    const p = probed[ans];
    chosen = { id: p.id, slotNumber: p.slotNumber, size: p.size, distance: p.distance, zone: p.zone };
    alternatives = probed
      .slice(ans + 1)
      .filter((s) => s.fits)
      .slice(0, 3)
      .map((s) => ({
        slot: { id: s.id, slotNumber: s.slotNumber, size: s.size, distance: s.distance, zone: s.zone },
        deltaMeters: s.distance - p.distance,
      }));
    const nearer = probed.slice(0, ans);
    const nearerTxt =
      nearer.length === 0
        ? "No free slot is closer to the entrance than this choice."
        : `Every nearer free slot (${nearer
            .map((s) => `${s.slotNumber}·${s.size}`)
            .join(", ")}) is too small for a ${vehicle.vehicleSize} vehicle.`;
    const altTxt =
      alternatives.length === 0
        ? "No other fitting slot remains — this is the only feasible option."
        : `The next fitting options are strictly farther: ${alternatives
            .map((a) => `${a.slot.slotNumber} (+${a.deltaMeters}m)`)
            .join(", ")}.`;
    explanation = `Binary search isolated the first index where a ${vehicle.vehicleSize}-capable slot exists: #${ans} → ${p.slotNumber} (${p.distance}m, ${p.size}). ${nearerTxt} ${altTxt} Taking the minimum-distance feasible slot is the greedy-optimal assignment: it minimizes this driver's walk + cruising distance while preserving larger / farther inventory for future requests.`;
  } else {
    explanation = `Binary search exhausted ${probed.length} free slot${probed.length === 1 ? "" : "s"} in ${comparisons} comparisons: no free slot can physically fit a ${vehicle.vehicleSize} vehicle. The request is re-queued (head-of-line) until a compatible slot is released.`;
  }

  return {
    vehicle,
    requiredRank: required,
    probedArray: probed,
    steps,
    comparisons,
    slotsScanned: probed.length,
    resultIndex: ans,
    chosen,
    alternatives,
    greedy: { explanation, rule },
  };
}

/* ------------------------------------------------------------------ */
/* Composite trace carried to the UI inspector                         */
/* ------------------------------------------------------------------ */
export interface QueueSnapshot {
  before: QueueItem[]; // exact pop order before serving
  after: QueueItem[];
  pushes: number;
  pops: number;
  swaps: number;
}

export interface AllocationTrace {
  queue: QueueSnapshot;
  search: SearchTrace;
}

/* ---------------------------------- */
/* helpers                            */
/* ---------------------------------- */
const PLATE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export function randomPlate(): string {
  const l = () => PLATE_LETTERS[Math.floor(Math.random() * PLATE_LETTERS.length)];
  const n = () => Math.floor(Math.random() * 10);
  return `${l()}${l()}-${n()}${n()}${n()}-${l()}${l()}`;
}

export function priorityLabel(p: number): string {
  return p === 1 ? "EMERGENCY" : p === 2 ? "VIP" : "STANDARD";
}

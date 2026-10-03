# SLOT//PILOT — Smart Parking Slot Allocator

> An **algorithm-transparent** parking allocator: every assignment shows you *how* it was decided — the priority queue pop order, the binary-search pointer sweep, and the greedy rationale — not just the final slot.

Built for a Design & Analysis of Algorithms (DAA) hackathon: the decision-making process is fully visual, replayable, and persisted.

---

## ✨ Features

- 🚗 **61-bay lot** — a bike ring (15 racks, 2–23 m) plus four car zones (12–197 m), sorted by distance from the gate
- ⛓️ **Instrumented binary min-heap** — requests ordered by `(priority_level, arrival_time)`; every push, pop and sift swap is counted; before/after **pop-order snapshots** per extraction
- 🔍 **Step-traced binary search** — free slots sorted by `distance_from_entrance`, searched via the monotone predicate *P(i) = a fitting slot exists at index ≤ i*; each probe records `low / mid / high`, the discarded half, and a narrative
- 🎯 **Greedy commitment** — takes the minimum-distance feasible slot and writes a rationale: which nearer slots were too small, which farther fits were rejected (+Δm), and why the pick is locally optimal
- 🖥️ **Live decision inspector** — animated replay of the LOW/MID/HIGH pointer sweep, heap state panels, greedy reasoning tab
- 📜 **Persisted traces** — every decision (ALLOCATED / WAITING / RELEASED) stored in PostgreSQL as JSONB, replayable from the log table
- 🚨 **Priority preemption** — submit a Standard car while an Emergency vehicle waits and the heap serves the emergency first (head-of-line order honored)
- 🚲 **Size-rank fit rule** — `slotRank ≥ vehicleRank`: bikes fit anywhere, trucks never take a bike rack

## 🧠 Algorithm Pipeline

| Stage | Data structure / strategy | Cost | What the UI shows |
|---|---|---|---|
| 1. Arrival & urgency | Binary min-heap | push / extract-min `O(log n)` | pop order, sift swaps, before/after states |
| 2. Slot discovery | Binary search over distance-sorted free slots + monotone predicate (prefix array) | `O(log n)` probes, `O(n)` one-time scan | animated low/mid/high pointers, comparison count |
| 3. Selection | Greedy: minimum-distance feasible slot | `O(1)` after bound found | chosen slot, rejected alternatives (+Δm), written rationale |

A typical live run: **5 comparisons over 45 free slots** vs. 45 for a brute-force scan.

## 🏗️ Tech Stack

- **Frontend** — Next.js (App Router, React 19), Tailwind CSS 4, lucide-react
- **Backend** — Next.js route handlers (REST), instrumented algorithm engine in TypeScript
- **Database** — PostgreSQL via Drizzle ORM (`parking_slots`, `vehicles`, `queue_entries`, `allocation_logs`)

## 🔌 API Reference

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/slots` | Current state of every slot + lot statistics |
| `POST` | `/api/request-parking` | Enqueue a vehicle (`{ licensePlate?, vehicleSize, priorityLevel }`), extract the heap head, allocate; returns assignment + **full algorithm trace** |
| `POST` | `/api/queue` | Enqueue without serving (batch simulation) (`GET` = pop-order snapshot, `DELETE` = clear) |
| `POST` | `/api/queue/process` | Serve `{ mode: "next" \| "all" }` — stops on head-of-line blocking |
| `POST` | `/api/release-slot` | Free a slot by `{ slotId }` |
| `GET` | `/api/logs` | Allocation history with persisted traces |

`vehicleSize`: `Bike | Small | Medium | Large` · `priorityLevel`: `1` Emergency, `2` VIP, `3` Standard

## 🚀 Getting Started

```bash
# 1. install
npm install

# 2. configure database
cp .env.example .env          # point DATABASE_URL at your PostgreSQL

# 3. push schema (tables auto-seed 61 slots on first request)
npx drizzle-kit push

# 4. run
npm run dev                   # http://localhost:3000
```

## 🎬 Judge Demo Script

1. **Simulate rush ×6**, then open tab **1 · PRIORITY QUEUE** — the heap ordered emergency vehicles to the front
2. **Process all** — watch each extraction serve P1 before P2 before P3 (FIFO within ties)
3. Open **2 · BINARY SEARCH** and press **Replay** — the LOW/MID/HIGH pointer sweep converges in ~5 comparisons over 45 slots
4. Read **3 · GREEDY PICK** — the chosen slot, the rejected farther alternatives, and the written rationale
5. Click a red (occupied) slot to release it, then re-process a blocked queue to show recovery
6. Click any row in the **allocation log** to replay that exact historical decision

## 📁 Project Structure

```
src/
├── lib/
│   ├── allocator.ts     # instrumented MinHeap + binary search + greedy (pure, trace-emitting)
│   ├── engine.ts        # DB orchestration: seeding, enqueue, serveHead, release, logs
│   └── dto.ts           # shared API types
├── db/                  # Drizzle schema + client
├── app/
│   ├── api/             # REST endpoints (slots, request-parking, queue, release-slot, logs, reset)
│   └── page.tsx         # dashboard shell + polling + toasts
└── components/          # parking map, control deck, algorithm inspector, log table
```

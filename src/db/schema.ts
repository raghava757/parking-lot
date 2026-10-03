import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* ParkingSlots                                                        */
/* ------------------------------------------------------------------ */
export const parkingSlots = pgTable(
  "parking_slots",
  {
    id: serial("id").primaryKey(),
    slotNumber: text("slot_number").notNull().unique(),
    size: text("size").notNull(), // 'Small' | 'Medium' | 'Large'
    distanceFromEntrance: integer("distance_from_entrance").notNull(),
    zone: text("zone").notNull(),
    isOccupied: boolean("is_occupied").notNull().default(false),
    occupiedByPlate: text("occupied_by_plate"),
    occupiedByVehicleId: integer("occupied_by_vehicle_id"),
  },
  (t) => [
    index("slots_distance_idx").on(t.distanceFromEntrance),
    index("slots_occupied_idx").on(t.isOccupied),
  ],
);

/* ------------------------------------------------------------------ */
/* Vehicles / Requests                                                 */
/* ------------------------------------------------------------------ */
export const vehicles = pgTable(
  "vehicles",
  {
    id: serial("id").primaryKey(),
    licensePlate: text("license_plate").notNull(),
    vehicleSize: text("vehicle_size").notNull(), // 'Small' | 'Medium' | 'Large'
    priorityLevel: integer("priority_level").notNull(), // 1 Emergency, 2 VIP, 3 Standard
    arrivalTime: timestamp("arrival_time", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull().default("QUEUED"), // QUEUED | PARKED | LEFT | WAITING
    assignedSlotId: integer("assigned_slot_id"),
  },
  (t) => [index("vehicles_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ */
/* Priority Queue persistence (heap is rebuilt instrumented on use)    */
/* ------------------------------------------------------------------ */
export const queueEntries = pgTable(
  "queue_entries",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id").notNull(),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("queue_vehicle_idx").on(t.vehicleId)],
);

/* ------------------------------------------------------------------ */
/* AllocationLogs — every algorithmic decision with full trace         */
/* ------------------------------------------------------------------ */
export const allocationLogs = pgTable(
  "allocation_logs",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id"),
    licensePlate: text("license_plate").notNull(),
    vehicleSize: text("vehicle_size").notNull(),
    priorityLevel: integer("priority_level").notNull(),
    slotId: integer("slot_id"),
    slotNumber: text("slot_number"),
    result: text("result").notNull(), // ALLOCATED | WAITING | RELEASED
    comparisons: integer("comparisons").notNull().default(0),
    heapOps: integer("heap_ops").notNull().default(0),
    slotsScanned: integer("slots_scanned").notNull().default(0),
    explanation: text("explanation").notNull().default(""),
    trace: jsonb("trace"), // full algorithm trace for replay
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("logs_created_idx").on(t.createdAt)],
);

export type ParkingSlot = typeof parkingSlots.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type QueueEntry = typeof queueEntries.$inferSelect;
export type AllocationLog = typeof allocationLogs.$inferSelect;

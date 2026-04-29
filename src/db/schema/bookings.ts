import {
  pgTable,
  uuid,
  varchar,
  integer,
  smallint,
  decimal,
  boolean,
  text,
  timestamp,
  pgEnum,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { drivers } from "./drivers.js";

export const rideTypeEnum = pgEnum("ride_type", [
  "bike",
  "keke",
  "cab",
  "shared",
  "intercity",
  "campus",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "finding",
  "negotiating",
  "accepted",
  "arriving",
  "ontrip",
  "completed",
  "cancelled",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    riderId: uuid("rider_id")
      .references(() => users.id)
      .notNull(),
    driverId: uuid("driver_id").references(() => drivers.id),
    rideType: rideTypeEnum("ride_type").notNull(),
    pickup: varchar("pickup", { length: 255 }).notNull(),
    destination: varchar("destination", { length: 255 }).notNull(),
    suggestedFare: integer("suggested_fare").notNull(),
    negotiatedFare: integer("negotiated_fare"),
    finalFare: integer("final_fare"),
    status: bookingStatusEnum("status").default("finding").notNull(),
    rating: smallint("rating"),
    ratingComment: text("rating_comment"),
    estimatedDistanceKm: decimal("estimated_distance_km", {
      precision: 6,
      scale: 2,
    }),
    estimatedDurationMins: integer("estimated_duration_mins"),
    sosActivated: boolean("sos_activated").default(false).notNull(),
    cancelledBy: varchar("cancelled_by", { length: 10 }),
    cancellationReason: text("cancellation_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "rating_range",
      sql`${table.rating} IS NULL OR (${table.rating} >= 1 AND ${table.rating} <= 5)`
    ),
    check(
      "cancelled_by_values",
      sql`${table.cancelledBy} IS NULL OR ${table.cancelledBy} IN ('rider', 'driver')`
    ),
  ]
);

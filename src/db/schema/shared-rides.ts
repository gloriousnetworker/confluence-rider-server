import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { drivers } from "./drivers.js";

export const sharedRideStatusEnum = pgEnum("shared_ride_status", [
  "open",        // accepting riders
  "full",        // max riders reached
  "in_progress", // trip started
  "completed",
  "cancelled",
]);

export const sharedRides = pgTable(
  "shared_rides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id").references(() => drivers.id),
    route: varchar("route", { length: 255 }).notNull(), // e.g. "Ganaja Junction → Nataco Junction"
    pickup: varchar("pickup", { length: 255 }).notNull(),
    destination: varchar("destination", { length: 255 }).notNull(),
    baseFare: integer("base_fare").notNull(), // full fare for the route
    farePerRider: integer("fare_per_rider").notNull(), // calculated split
    maxRiders: integer("max_riders").default(4).notNull(),
    currentRiders: integer("current_riders").default(0).notNull(),
    status: sharedRideStatusEnum("status").default("open").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shared_rides_status_idx").on(table.status),
    index("shared_rides_route_idx").on(table.pickup, table.destination),
  ]
);

// Riders who joined a shared ride
import { users } from "./users.js";
import { bookings } from "./bookings.js";

export const sharedRideRiders = pgTable(
  "shared_ride_riders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sharedRideId: uuid("shared_ride_id")
      .references(() => sharedRides.id)
      .notNull(),
    riderId: uuid("rider_id")
      .references(() => users.id)
      .notNull(),
    bookingId: uuid("booking_id")
      .references(() => bookings.id)
      .notNull(),
    fareShare: integer("fare_share").notNull(), // what this rider pays
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shared_ride_riders_pool_idx").on(table.sharedRideId),
  ]
);

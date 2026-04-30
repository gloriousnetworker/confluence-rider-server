import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  time,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const shuttleDayEnum = pgEnum("shuttle_day", [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]);

// Shuttle routes — fixed campus routes
export const shuttleRoutes = pgTable("shuttle_routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // e.g. "KSU Express"
  origin: varchar("origin", { length: 255 }).notNull(), // e.g. "Lokoja"
  destination: varchar("destination", { length: 255 }).notNull(), // e.g. "Kogi State University"
  stops: varchar("stops", { length: 500 }), // comma-separated: "Ganaja,Anyigba Market"
  fare: integer("fare").notNull(), // student fare in Naira
  regularFare: integer("regular_fare").notNull(), // non-student fare
  capacity: integer("capacity").default(20).notNull(), // seats per trip
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Shuttle schedules — departure times per day
export const shuttleSchedules = pgTable(
  "shuttle_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routeId: uuid("route_id").references(() => shuttleRoutes.id).notNull(),
    day: shuttleDayEnum("day").notNull(),
    departureTime: time("departure_time").notNull(), // e.g. "07:30"
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    index("shuttle_schedules_route_day_idx").on(table.routeId, table.day),
  ]
);

export const shuttleBookingStatusEnum = pgEnum("shuttle_booking_status", [
  "confirmed", "cancelled", "completed",
]);

// Shuttle bookings — seats reserved by riders
export const shuttleBookings = pgTable(
  "shuttle_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduleId: uuid("schedule_id").references(() => shuttleSchedules.id).notNull(),
    routeId: uuid("route_id").references(() => shuttleRoutes.id).notNull(),
    riderId: uuid("rider_id").references(() => users.id).notNull(),
    seatCount: integer("seat_count").default(1).notNull(),
    fare: integer("fare").notNull(),
    isStudent: boolean("is_student").default(false).notNull(),
    status: shuttleBookingStatusEnum("status").default("confirmed").notNull(),
    travelDate: timestamp("travel_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shuttle_bookings_schedule_idx").on(table.scheduleId),
    index("shuttle_bookings_rider_idx").on(table.riderId),
  ]
);

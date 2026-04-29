import {
  pgTable,
  uuid,
  decimal,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings.js";
import { users } from "./users.js";

export const sosStatusEnum = pgEnum("sos_status", [
  "active",
  "responding",
  "resolved",
  "false_alarm",
]);

export const sosAlerts = pgTable(
  "sos_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => bookings.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    status: sosStatusEnum("status").default("active").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sos_alerts_booking_id_idx").on(table.bookingId),
    index("sos_alerts_status_idx").on(table.status),
  ]
);

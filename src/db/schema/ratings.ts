import {
  pgTable,
  uuid,
  smallint,
  text,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { bookings } from "./bookings.js";

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => bookings.id)
      .notNull()
      .unique(),
    riderRating: smallint("rider_rating"),
    driverRating: smallint("driver_rating"),
    riderReview: text("rider_review"),
    driverReview: text("driver_review"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "rider_rating_range",
      sql`${table.riderRating} IS NULL OR (${table.riderRating} >= 1 AND ${table.riderRating} <= 5)`
    ),
    check(
      "driver_rating_range",
      sql`${table.driverRating} IS NULL OR (${table.driverRating} >= 1 AND ${table.driverRating} <= 5)`
    ),
    index("ratings_booking_id_idx").on(table.bookingId),
  ]
);

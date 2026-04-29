import {
  pgTable,
  uuid,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings.js";

export const fareOfferStatusEnum = pgEnum("fare_offer_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);

export const fareOffers = pgTable(
  "fare_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => bookings.id)
      .notNull(),
    riderOffer: integer("rider_offer").notNull(),
    driverCounterOffer: integer("driver_counter_offer"),
    finalPrice: integer("final_price"),
    status: fareOfferStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("fare_offers_booking_id_idx").on(table.bookingId),
  ]
);

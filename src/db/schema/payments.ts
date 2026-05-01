import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings.js";

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "wallet",
  "ussd",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => bookings.id),
    amount: integer("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    transactionRef: varchar("transaction_ref", { length: 100 }),
    gatewayResponse: varchar("gateway_response", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payments_booking_id_idx").on(table.bookingId),
  ]
);

import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  pgEnum,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { wallets } from "./wallets.js";
import { users } from "./users.js";
import { bookings } from "./bookings.js";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "debit",
  "credit",
]);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .references(() => wallets.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    type: transactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    reference: varchar("reference", { length: 100 }),
    bookingId: uuid("booking_id").references(() => bookings.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("amount_positive", sql`${table.amount} > 0`),
    index("transactions_wallet_id_idx").on(table.walletId),
    index("transactions_user_id_idx").on(table.userId),
    index("transactions_created_at_idx").on(table.createdAt),
  ]
);

import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { bookings } from "./bookings.js";

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    discountPercent: integer("discount_percent").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usageLimit: integer("usage_limit"),
    timesUsed: integer("times_used").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "discount_range",
      sql`${table.discountPercent} >= 1 AND ${table.discountPercent} <= 100`
    ),
  ]
);

export const promoUsages = pgTable(
  "promo_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promoId: uuid("promo_id")
      .references(() => promoCodes.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    usedAt: timestamp("used_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => []
);

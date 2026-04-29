import {
  pgTable,
  uuid,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "completed",
  "expired",
]);

export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerId: uuid("referrer_id")
    .references(() => users.id)
    .notNull(),
  referredUserId: uuid("referred_user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  bonusAmount: integer("bonus_amount").default(500).notNull(),
  status: referralStatusEnum("status").default("pending").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

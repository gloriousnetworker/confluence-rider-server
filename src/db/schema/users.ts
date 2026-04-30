import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "rider",
  "driver",
  "admin",
]);

export const memberStatusEnum = pgEnum("member_status", [
  "bronze",
  "silver",
  "gold",
]);

export const languagePrefEnum = pgEnum("language_pref", [
  "english",
  "ebira",
  "igala",
  "yoruba",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 15 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("rider").notNull(),
  memberStatus: memberStatusEnum("member_status").default("bronze").notNull(),
  language: languagePrefEnum("language").default("english").notNull(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  isPhoneVerified: boolean("is_phone_verified").default(false).notNull(),
  is2faEnabled: boolean("is_2fa_enabled").default(false).notNull(),
  isSuspended: boolean("is_suspended").default(false).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

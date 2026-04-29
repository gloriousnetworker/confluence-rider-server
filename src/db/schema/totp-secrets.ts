import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const totpSecrets = pgTable("totp_secrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  secret: varchar("secret", { length: 255 }).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  backupCodes: jsonb("backup_codes").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

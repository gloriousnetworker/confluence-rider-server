import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { bookings } from "./bookings.js";

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
    senderId: uuid("sender_id").references(() => users.id).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chat_messages_booking_idx").on(table.bookingId),
  ]
);

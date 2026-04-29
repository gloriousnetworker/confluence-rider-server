import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { landmarks } from "./landmarks.js";

export const savedPlaceLabelEnum = pgEnum("saved_place_label", [
  "home",
  "work",
  "campus",
  "other",
]);

export const savedPlaces = pgTable(
  "saved_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    label: savedPlaceLabelEnum("label").notNull(),
    customLabel: varchar("custom_label", { length: 100 }),
    address: varchar("address", { length: 255 }).notNull(),
    landmarkId: uuid("landmark_id").references(() => landmarks.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("saved_places_user_label_unique").on(table.userId, table.label),
  ]
);

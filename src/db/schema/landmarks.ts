import {
  pgTable,
  uuid,
  varchar,
  decimal,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const landmarks = pgTable(
  "landmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    area: varchar("area", { length: 100 }).notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    isPopular: boolean("is_popular").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("landmarks_area_idx").on(table.area)]
);

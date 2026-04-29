import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { drivers } from "./drivers.js";
import { vehicleTypeEnum } from "./drivers.js";

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => drivers.id)
    .notNull(),
  type: vehicleTypeEnum("type").notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  color: varchar("color", { length: 30 }).notNull(),
  plateNumber: varchar("plate_number", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

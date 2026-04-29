import {
  pgTable,
  uuid,
  varchar,
  decimal,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "bike",
  "keke",
  "car",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
]);

export const drivers = pgTable("drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).unique(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 15 }).notNull().unique(),
  rating: decimal("rating", { precision: 2, scale: 1 })
    .default("5.0")
    .notNull(),
  totalTrips: integer("total_trips").default(0).notNull(),
  zone: varchar("zone", { length: 100 }).notNull(),
  vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
  // KYC fields
  licenseNumber: varchar("license_number", { length: 50 }),
  vehicleModel: varchar("vehicle_model", { length: 100 }),
  vehicleColor: varchar("vehicle_color", { length: 30 }),
  plateNumber: varchar("plate_number", { length: 20 }),
  verificationStatus: verificationStatusEnum("verification_status")
    .default("pending")
    .notNull(),
  // Availability
  isAvailable: boolean("is_available").default(true).notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  currentLocationLat: decimal("current_location_lat", { precision: 10, scale: 7 }),
  currentLocationLng: decimal("current_location_lng", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

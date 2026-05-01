import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  boolean,
  decimal,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { drivers } from "./drivers.js";

export const deliveryTypeEnum = pgEnum("delivery_type", [
  "food",
  "courier",
  "package",
  "grocery",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",       // order placed
  "confirmed",     // sender confirmed
  "finding_rider", // looking for delivery driver
  "picked_up",     // driver picked up item
  "in_transit",    // on the way
  "delivered",     // delivered to recipient
  "cancelled",
]);

export const deliverySizeEnum = pgEnum("delivery_size", [
  "small",    // envelope, document
  "medium",   // box, bag
  "large",    // furniture, appliance
]);

export const deliveryOrders = pgTable(
  "delivery_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id").references(() => users.id).notNull(),
    driverId: uuid("driver_id").references(() => drivers.id),
    type: deliveryTypeEnum("type").notNull(),
    size: deliverySizeEnum("size").default("small").notNull(),
    // Pickup
    pickupAddress: varchar("pickup_address", { length: 255 }).notNull(),
    pickupContact: varchar("pickup_contact", { length: 100 }),
    pickupPhone: varchar("pickup_phone", { length: 15 }),
    // Dropoff
    dropoffAddress: varchar("dropoff_address", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 100 }).notNull(),
    recipientPhone: varchar("recipient_phone", { length: 15 }).notNull(),
    // Item details
    itemDescription: varchar("item_description", { length: 500 }).notNull(),
    specialInstructions: text("special_instructions"),
    // Pricing
    estimatedFare: integer("estimated_fare").notNull(),
    finalFare: integer("final_fare"),
    // Status
    status: deliveryStatusEnum("status").default("pending").notNull(),
    // Tracking
    estimatedDistanceKm: decimal("estimated_distance_km", { precision: 6, scale: 2 }),
    estimatedDurationMins: integer("estimated_duration_mins"),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    // Meta
    isFragile: boolean("is_fragile").default(false).notNull(),
    requiresSignature: boolean("requires_signature").default(false).notNull(),
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("delivery_orders_sender_idx").on(table.senderId),
    index("delivery_orders_driver_idx").on(table.driverId),
    index("delivery_orders_status_idx").on(table.status),
  ]
);

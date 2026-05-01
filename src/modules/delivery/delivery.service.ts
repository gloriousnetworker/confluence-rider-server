import { eq, and, count, desc } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { getOffset, buildPaginationMeta } from "../../utils/pagination.js";
import { emitBookingStatusChange } from "../../services/socket.js";

// Delivery fare calculation
const BASE_FARES: Record<string, number> = { food: 300, courier: 400, package: 500, grocery: 350 };
const SIZE_MULTIPLIERS: Record<string, number> = { small: 1, medium: 1.5, large: 2.5 };
const DEFAULT_DISTANCE_KM = 5;
const RATE_PER_KM = 50;

function calculateDeliveryFare(type: string, size: string): number {
  const base = BASE_FARES[type] || 400;
  const multiplier = SIZE_MULTIPLIERS[size] || 1;
  return Math.round((base + RATE_PER_KM * DEFAULT_DISTANCE_KM) * multiplier);
}

export async function createDeliveryOrder(senderId: string, input: any) {
  const estimatedFare = calculateDeliveryFare(input.type, input.size);

  const [order] = await db.insert(schema.deliveryOrders).values({
    senderId,
    type: input.type,
    size: input.size,
    pickupAddress: input.pickupAddress,
    pickupContact: input.pickupContact,
    pickupPhone: input.pickupPhone,
    dropoffAddress: input.dropoffAddress,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    itemDescription: input.itemDescription,
    specialInstructions: input.specialInstructions,
    isFragile: input.isFragile,
    requiresSignature: input.requiresSignature,
    estimatedFare,
    estimatedDistanceKm: DEFAULT_DISTANCE_KM.toString(),
    estimatedDurationMins: 30,
    status: "pending",
  }).returning();

  // Notification
  await db.insert(schema.notifications).values({
    userId: senderId,
    type: "trip",
    title: "Delivery Order Placed",
    description: `Your ${input.type} delivery to ${input.recipientName} has been placed. Estimated: ₦${estimatedFare}`,
  });

  return { ...order, estimatedFare };
}

export async function getDeliveryOrder(orderId: string, userId: string) {
  const [order] = await db.select().from(schema.deliveryOrders)
    .where(eq(schema.deliveryOrders.id, orderId)).limit(1);

  if (!order) throw new AppError(404, "NOT_FOUND", "Delivery order not found");
  if (order.senderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  let driver = null;
  if (order.driverId) {
    const [d] = await db.select({ name: schema.drivers.name, phone: schema.drivers.phone, rating: schema.drivers.rating })
      .from(schema.drivers).where(eq(schema.drivers.id, order.driverId)).limit(1);
    driver = d;
  }

  return { ...order, driver };
}

export async function getMyDeliveries(userId: string, filters: { status?: string; type?: string; page: number; limit: number }) {
  const conditions: any[] = [eq(schema.deliveryOrders.senderId, userId)];
  if (filters.status) conditions.push(eq(schema.deliveryOrders.status, filters.status as any));
  if (filters.type) conditions.push(eq(schema.deliveryOrders.type, filters.type as any));

  const [totalResult] = await db.select({ total: count() }).from(schema.deliveryOrders).where(and(...conditions));
  const total = totalResult?.total ?? 0;

  const orders = await db.select().from(schema.deliveryOrders)
    .where(and(...conditions))
    .orderBy(desc(schema.deliveryOrders.createdAt))
    .limit(filters.limit).offset(getOffset(filters.page, filters.limit));

  return { orders, meta: buildPaginationMeta(filters.page, filters.limit, total) };
}

export async function updateDeliveryStatus(orderId: string, userId: string, newStatus: string) {
  const [order] = await db.select().from(schema.deliveryOrders)
    .where(eq(schema.deliveryOrders.id, orderId)).limit(1);

  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["finding_rider", "cancelled"],
    finding_rider: ["picked_up", "cancelled"],
    picked_up: ["in_transit", "cancelled"],
    in_transit: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
  };

  if (!validTransitions[order.status]?.includes(newStatus)) {
    throw new AppError(422, "INVALID_STATE_TRANSITION", `Cannot change from ${order.status} to ${newStatus}`);
  }

  const updates: Record<string, any> = { status: newStatus, updatedAt: new Date() };
  if (newStatus === "picked_up") updates.pickedUpAt = new Date();
  if (newStatus === "delivered") {
    updates.deliveredAt = new Date();
    updates.finalFare = order.estimatedFare;
  }

  // Auto-assign a driver when finding_rider
  if (newStatus === "finding_rider") {
    const [driver] = await db.select().from(schema.drivers)
      .where(and(eq(schema.drivers.isOnline, true), eq(schema.drivers.isAvailable, true)))
      .limit(1);

    if (driver) {
      updates.driverId = driver.id;
      await db.update(schema.drivers).set({ isAvailable: false, updatedAt: new Date() })
        .where(eq(schema.drivers.id, driver.id));
    }
  }

  // Release driver on cancel
  if (newStatus === "cancelled" && order.driverId) {
    await db.update(schema.drivers).set({ isAvailable: true, updatedAt: new Date() })
      .where(eq(schema.drivers.id, order.driverId));
  }

  // Deduct from wallet on delivery
  if (newStatus === "delivered") {
    const fare = order.estimatedFare;
    const [wallet] = await db.select().from(schema.wallets)
      .where(eq(schema.wallets.userId, order.senderId)).limit(1);

    if (wallet && wallet.balance >= fare) {
      await db.update(schema.wallets).set({ balance: wallet.balance - fare, updatedAt: new Date() })
        .where(eq(schema.wallets.id, wallet.id));

      await db.insert(schema.transactions).values({
        walletId: wallet.id,
        userId: order.senderId,
        type: "debit",
        amount: fare,
        description: `${order.type} delivery to ${order.recipientName}`,
      });
    }
  }

  const [updated] = await db.update(schema.deliveryOrders).set(updates)
    .where(eq(schema.deliveryOrders.id, orderId)).returning();

  // Notify
  const statusMessages: Record<string, string> = {
    confirmed: "Your delivery order has been confirmed",
    finding_rider: "Finding a delivery rider for your package",
    picked_up: "Your item has been picked up",
    in_transit: "Your delivery is on the way",
    delivered: `Delivered to ${order.recipientName}! Fare: ₦${order.estimatedFare}`,
    cancelled: "Your delivery order has been cancelled",
  };

  await db.insert(schema.notifications).values({
    userId: order.senderId,
    type: "trip",
    title: `Delivery ${newStatus.replace("_", " ")}`,
    description: statusMessages[newStatus] || `Status: ${newStatus}`,
  });

  return updated;
}

export async function rateDelivery(orderId: string, userId: string, rating: number) {
  const [order] = await db.select().from(schema.deliveryOrders)
    .where(eq(schema.deliveryOrders.id, orderId)).limit(1);

  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found");
  if (order.senderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");
  if (order.status !== "delivered") throw new AppError(422, "INVALID_STATE", "Can only rate delivered orders");

  const [updated] = await db.update(schema.deliveryOrders)
    .set({ rating, updatedAt: new Date() })
    .where(eq(schema.deliveryOrders.id, orderId)).returning();

  return updated;
}

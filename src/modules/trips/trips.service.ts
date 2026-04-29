import { eq, and, count, desc, sql } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { getOffset, buildPaginationMeta } from "../../utils/pagination.js";

export async function getTrips(
  userId: string,
  filters: { status?: string; type?: string; page: number; limit: number }
) {
  const conditions: any[] = [eq(schema.bookings.riderId, userId)];

  if (filters.status) {
    conditions.push(eq(schema.bookings.status, filters.status as any));
  } else {
    // Default: only show completed and cancelled (not active bookings)
    conditions.push(
      sql`${schema.bookings.status} IN ('completed', 'cancelled')`
    );
  }

  if (filters.type) {
    conditions.push(eq(schema.bookings.rideType, filters.type as any));
  }

  const [totalResult] = await db
    .select({ total: count() })
    .from(schema.bookings)
    .where(and(...conditions));

  const total = totalResult?.total ?? 0;
  const offset = getOffset(filters.page, filters.limit);

  const trips = await db
    .select({
      id: schema.bookings.id,
      rideType: schema.bookings.rideType,
      pickup: schema.bookings.pickup,
      destination: schema.bookings.destination,
      suggestedFare: schema.bookings.suggestedFare,
      finalFare: schema.bookings.finalFare,
      status: schema.bookings.status,
      rating: schema.bookings.rating,
      startedAt: schema.bookings.startedAt,
      completedAt: schema.bookings.completedAt,
      createdAt: schema.bookings.createdAt,
      driverName: schema.drivers.name,
    })
    .from(schema.bookings)
    .leftJoin(schema.drivers, eq(schema.bookings.driverId, schema.drivers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.bookings.createdAt))
    .limit(filters.limit)
    .offset(offset);

  return {
    trips,
    meta: buildPaginationMeta(filters.page, filters.limit, total),
  };
}

export async function getReceipt(tripId: string, userId: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, tripId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Trip not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");
  if (booking.status !== "completed") {
    throw new AppError(422, "INVALID_STATE_TRANSITION", "Receipt only available for completed trips");
  }

  let driver = null;
  if (booking.driverId) {
    const [d] = await db
      .select({ name: schema.drivers.name, rating: schema.drivers.rating })
      .from(schema.drivers)
      .where(eq(schema.drivers.id, booking.driverId))
      .limit(1);
    driver = d;
  }

  return {
    bookingId: booking.id,
    rideType: booking.rideType,
    pickup: booking.pickup,
    destination: booking.destination,
    suggestedFare: booking.suggestedFare,
    negotiatedFare: booking.negotiatedFare,
    finalFare: booking.finalFare,
    driver,
    startedAt: booking.startedAt,
    completedAt: booking.completedAt,
    estimatedDistanceKm: booking.estimatedDistanceKm,
    currency: "NGN",
  };
}

import { eq, and, ilike, count, desc, sql } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";

/**
 * Get all active shuttle routes.
 */
export async function getRoutes(filters?: { origin?: string; destination?: string }) {
  const conditions: any[] = [eq(schema.shuttleRoutes.isActive, true)];
  if (filters?.origin) conditions.push(ilike(schema.shuttleRoutes.origin, `%${filters.origin}%`));
  if (filters?.destination) conditions.push(ilike(schema.shuttleRoutes.destination, `%${filters.destination}%`));

  return db.select().from(schema.shuttleRoutes).where(and(...conditions));
}

/**
 * Get schedules for a route or day.
 */
export async function getSchedules(filters?: { routeId?: string; day?: string }) {
  const conditions: any[] = [eq(schema.shuttleSchedules.isActive, true)];
  if (filters?.routeId) conditions.push(eq(schema.shuttleSchedules.routeId, filters.routeId));
  if (filters?.day) conditions.push(eq(schema.shuttleSchedules.day, filters.day as any));

  const schedules = await db
    .select({
      id: schema.shuttleSchedules.id,
      routeId: schema.shuttleSchedules.routeId,
      day: schema.shuttleSchedules.day,
      departureTime: schema.shuttleSchedules.departureTime,
      routeName: schema.shuttleRoutes.name,
      origin: schema.shuttleRoutes.origin,
      destination: schema.shuttleRoutes.destination,
      stops: schema.shuttleRoutes.stops,
      fare: schema.shuttleRoutes.fare,
      regularFare: schema.shuttleRoutes.regularFare,
      capacity: schema.shuttleRoutes.capacity,
    })
    .from(schema.shuttleSchedules)
    .innerJoin(schema.shuttleRoutes, eq(schema.shuttleSchedules.routeId, schema.shuttleRoutes.id))
    .where(and(...conditions))
    .orderBy(schema.shuttleSchedules.departureTime);

  return schedules;
}

/**
 * Book a shuttle seat.
 */
export async function bookShuttle(
  userId: string,
  input: { scheduleId: string; travelDate: string; seatCount: number; isStudent: boolean }
) {
  // Get schedule + route
  const [schedule] = await db
    .select({
      id: schema.shuttleSchedules.id,
      routeId: schema.shuttleSchedules.routeId,
      day: schema.shuttleSchedules.day,
      departureTime: schema.shuttleSchedules.departureTime,
      fare: schema.shuttleRoutes.fare,
      regularFare: schema.shuttleRoutes.regularFare,
      capacity: schema.shuttleRoutes.capacity,
      routeName: schema.shuttleRoutes.name,
    })
    .from(schema.shuttleSchedules)
    .innerJoin(schema.shuttleRoutes, eq(schema.shuttleSchedules.routeId, schema.shuttleRoutes.id))
    .where(eq(schema.shuttleSchedules.id, input.scheduleId))
    .limit(1);

  if (!schedule) throw new AppError(404, "NOT_FOUND", "Schedule not found");

  // Check available seats for the given date
  const travelDate = new Date(input.travelDate);
  const dayStart = new Date(travelDate.getFullYear(), travelDate.getMonth(), travelDate.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [booked] = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.shuttleBookings.seatCount}), 0)` })
    .from(schema.shuttleBookings)
    .where(
      and(
        eq(schema.shuttleBookings.scheduleId, input.scheduleId),
        eq(schema.shuttleBookings.status, "confirmed"),
        sql`${schema.shuttleBookings.travelDate} >= ${dayStart.toISOString()}`,
        sql`${schema.shuttleBookings.travelDate} < ${dayEnd.toISOString()}`
      )
    );

  const seatsBooked = Number(booked?.total ?? 0);
  const seatsAvailable = schedule.capacity - seatsBooked;

  if (input.seatCount > seatsAvailable) {
    throw new AppError(422, "SEATS_UNAVAILABLE", `Only ${seatsAvailable} seat${seatsAvailable !== 1 ? "s" : ""} available`);
  }

  const farePerSeat = input.isStudent ? schedule.fare : schedule.regularFare;
  const totalFare = farePerSeat * input.seatCount;

  const [booking] = await db.insert(schema.shuttleBookings).values({
    scheduleId: input.scheduleId,
    routeId: schedule.routeId,
    riderId: userId,
    seatCount: input.seatCount,
    fare: totalFare,
    isStudent: input.isStudent,
    travelDate,
    status: "confirmed",
  }).returning();

  // Create notification
  await db.insert(schema.notifications).values({
    userId,
    type: "trip",
    title: "Shuttle Booked!",
    description: `${schedule.routeName} on ${travelDate.toLocaleDateString("en-NG", { weekday: "long", month: "short", day: "numeric" })} at ${schedule.departureTime}. ${input.seatCount} seat${input.seatCount > 1 ? "s" : ""} — ₦${totalFare}`,
  });

  return {
    booking,
    route: schedule.routeName,
    departureTime: schedule.departureTime,
    seatsRemaining: seatsAvailable - input.seatCount,
    farePerSeat,
    totalFare,
    isStudent: input.isStudent,
    message: `Booked ${input.seatCount} seat${input.seatCount > 1 ? "s" : ""} on ${schedule.routeName}!`,
  };
}

/**
 * Get rider's shuttle bookings.
 */
export async function getMyShuttleBookings(userId: string) {
  return db
    .select({
      id: schema.shuttleBookings.id,
      seatCount: schema.shuttleBookings.seatCount,
      fare: schema.shuttleBookings.fare,
      isStudent: schema.shuttleBookings.isStudent,
      status: schema.shuttleBookings.status,
      travelDate: schema.shuttleBookings.travelDate,
      createdAt: schema.shuttleBookings.createdAt,
      routeName: schema.shuttleRoutes.name,
      origin: schema.shuttleRoutes.origin,
      destination: schema.shuttleRoutes.destination,
      departureTime: schema.shuttleSchedules.departureTime,
    })
    .from(schema.shuttleBookings)
    .innerJoin(schema.shuttleRoutes, eq(schema.shuttleBookings.routeId, schema.shuttleRoutes.id))
    .innerJoin(schema.shuttleSchedules, eq(schema.shuttleBookings.scheduleId, schema.shuttleSchedules.id))
    .where(eq(schema.shuttleBookings.riderId, userId))
    .orderBy(desc(schema.shuttleBookings.travelDate))
    .limit(20);
}

/**
 * Cancel a shuttle booking.
 */
export async function cancelShuttleBooking(userId: string, bookingId: string) {
  const [booking] = await db.select().from(schema.shuttleBookings)
    .where(eq(schema.shuttleBookings.id, bookingId)).limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");
  if (booking.status !== "confirmed") throw new AppError(422, "INVALID_STATE", "Cannot cancel this booking");

  const [updated] = await db.update(schema.shuttleBookings)
    .set({ status: "cancelled" })
    .where(eq(schema.shuttleBookings.id, bookingId))
    .returning();

  return { ...updated, message: "Shuttle booking cancelled" };
}

import { eq, and, ne } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { calculateFare, isPeakHour } from "../../utils/fare.js";
import { assertTransition, isTerminalStatus } from "../../utils/state-machine.js";
import type { CreateBookingInput, AcceptDriverInput, RateBookingInput } from "./bookings.schema.js";
import type { RideType, BookingStatus } from "../../types/index.js";
import { emitBookingStatusChange, emitDriverMatched, emitSosAlert, emitNotification } from "../../services/socket.js";
import { sendTripReceiptEmail } from "../../services/email.js";

const RIDE_TO_VEHICLE: Record<RideType, string[]> = {
  bike: ["bike"],
  keke: ["keke"],
  cab: ["car"],
  shared: ["car"],
  intercity: ["car"],
  campus: ["keke", "car"],
};

// Default distance for MVP (no real geocoding yet)
const DEFAULT_DISTANCE_KM = 8.2;

export async function createBooking(riderId: string, input: CreateBookingInput) {
  const fare = calculateFare({
    rideType: input.rideType,
    distanceKm: DEFAULT_DISTANCE_KM,
    peakMultiplier: isPeakHour() ? 1.3 : 1.0,
  });

  const [booking] = await db
    .insert(schema.bookings)
    .values({
      riderId,
      rideType: input.rideType,
      pickup: input.pickup,
      destination: input.destination,
      suggestedFare: fare.suggestedFare,
      estimatedDistanceKm: DEFAULT_DISTANCE_KM.toString(),
      estimatedDurationMins: 15,
      status: "finding",
    })
    .returning();

  return {
    ...booking,
    suggestedFare: fare.suggestedFare,
    lowFare: fare.lowFare,
    highFare: fare.highFare,
  };
}

export async function getBooking(bookingId: string, userId: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new AppError(404, "NOT_FOUND", "Booking not found");
  }

  if (booking.riderId !== userId) {
    throw new AppError(403, "FORBIDDEN", "Access denied");
  }

  // Get driver info if assigned
  let driver = null;
  if (booking.driverId) {
    const [d] = await db
      .select({
        id: schema.drivers.id,
        name: schema.drivers.name,
        phone: schema.drivers.phone,
        rating: schema.drivers.rating,
        totalTrips: schema.drivers.totalTrips,
        zone: schema.drivers.zone,
        vehicleType: schema.drivers.vehicleType,
        vehicleModel: schema.drivers.vehicleModel,
        plateNumber: schema.drivers.plateNumber,
      })
      .from(schema.drivers)
      .where(eq(schema.drivers.id, booking.driverId))
      .limit(1);
    driver = d;
  }

  return { ...booking, driver };
}

export async function setNegotiatedFare(bookingId: string, userId: string, negotiatedFare: number) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  assertTransition(booking.status as BookingStatus, "negotiating");

  const [updated] = await db
    .update(schema.bookings)
    .set({ negotiatedFare, status: "negotiating", updatedAt: new Date() })
    .where(eq(schema.bookings.id, bookingId))
    .returning();

  return updated;
}

export async function getAvailableDrivers(bookingId: string, userId: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  const vehicleTypes = RIDE_TO_VEHICLE[booking.rideType as RideType] || ["car"];

  const drivers = await db
    .select({
      id: schema.drivers.id,
      name: schema.drivers.name,
      rating: schema.drivers.rating,
      totalTrips: schema.drivers.totalTrips,
      zone: schema.drivers.zone,
      vehicleType: schema.drivers.vehicleType,
    })
    .from(schema.drivers)
    .where(
      and(
        eq(schema.drivers.isOnline, true),
        eq(schema.drivers.isAvailable, true),
        eq(schema.drivers.isVerified, true)
      )
    );

  // Filter by vehicle type in JS (drizzle doesn't have easy IN for enums)
  const filtered = drivers.filter((d) => vehicleTypes.includes(d.vehicleType));

  // Simulate counter-offers
  const baseFare = booking.negotiatedFare || booking.suggestedFare;
  return filtered.map((d) => ({
    ...d,
    counterFare: baseFare + Math.floor(Math.random() * 150 - 50),
  }));
}

export async function acceptDriver(bookingId: string, userId: string, input: AcceptDriverInput) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  assertTransition(booking.status as BookingStatus, "accepted");

  // Verify driver exists and is available
  const [driver] = await db
    .select()
    .from(schema.drivers)
    .where(eq(schema.drivers.id, input.driverId))
    .limit(1);

  if (!driver) throw new AppError(404, "NOT_FOUND", "Driver not found");
  if (!driver.isAvailable) throw new AppError(422, "DRIVER_UNAVAILABLE", "Driver is no longer available");

  // Update booking + mark driver unavailable
  const [updated] = await db.transaction(async (tx) => {
    const [b] = await tx
      .update(schema.bookings)
      .set({
        driverId: input.driverId,
        finalFare: input.agreedFare,
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, bookingId))
      .returning();

    await tx
      .update(schema.drivers)
      .set({ isAvailable: false, updatedAt: new Date() })
      .where(eq(schema.drivers.id, input.driverId));

    return [b];
  });

  // Real-time: notify rider that driver was matched
  emitBookingStatusChange(bookingId, "accepted", { driverId: input.driverId, agreedFare: input.agreedFare });
  emitDriverMatched(bookingId, { id: driver.id, name: driver.name, rating: driver.rating, zone: driver.zone });

  return updated;
}

export async function updateStatus(bookingId: string, userId: string, newStatus: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  assertTransition(booking.status as BookingStatus, newStatus as BookingStatus);

  const updates: Record<string, any> = { status: newStatus, updatedAt: new Date() };
  if (newStatus === "ontrip") updates.startedAt = new Date();

  const [updated] = await db
    .update(schema.bookings)
    .set(updates)
    .where(eq(schema.bookings.id, bookingId))
    .returning();

  emitBookingStatusChange(bookingId, newStatus);

  return updated;
}

export async function completeBooking(bookingId: string, userId: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  assertTransition(booking.status as BookingStatus, "completed");

  const fare = booking.finalFare || booking.negotiatedFare || booking.suggestedFare;

  const result = await db.transaction(async (tx) => {
    // 1. Complete booking
    const [completed] = await tx
      .update(schema.bookings)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.bookings.id, bookingId))
      .returning();

    // 2. Deduct from rider wallet
    const [wallet] = await tx
      .select()
      .from(schema.wallets)
      .where(eq(schema.wallets.userId, userId));

    if (wallet && wallet.balance >= fare) {
      await tx
        .update(schema.wallets)
        .set({ balance: wallet.balance - fare, updatedAt: new Date() })
        .where(eq(schema.wallets.id, wallet.id));

      await tx.insert(schema.transactions).values({
        walletId: wallet.id,
        userId,
        type: "debit",
        amount: fare,
        description: `Ride to ${booking.destination}`,
        bookingId,
      });
    }

    // 3. Mark driver available + increment trips
    if (booking.driverId) {
      await tx
        .update(schema.drivers)
        .set({
          isAvailable: true,
          totalTrips: booking.driverId
            ? (await tx.select({ t: schema.drivers.totalTrips }).from(schema.drivers).where(eq(schema.drivers.id, booking.driverId)).limit(1))[0].t + 1
            : 0,
          updatedAt: new Date(),
        })
        .where(eq(schema.drivers.id, booking.driverId));
    }

    // 4. Create notification
    await tx.insert(schema.notifications).values({
      userId,
      type: "trip",
      title: "Trip Completed",
      description: `Your ride to ${booking.destination} has been completed. Fare: ₦${fare}`,
    });

    return completed;
  });

  emitBookingStatusChange(bookingId, "completed", { fare: result.finalFare });
  emitNotification(userId, { type: "trip", title: "Trip Completed", description: `Your ride to ${booking.destination} is complete.` });

  // Send receipt email (non-blocking)
  const [riderForEmail] = await db
    .select({ email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (riderForEmail?.email) {
    const driverName = booking.driverId
      ? (await db.select({ name: schema.drivers.name }).from(schema.drivers).where(eq(schema.drivers.id, booking.driverId)).limit(1))[0]?.name || "Driver"
      : "Driver";

    sendTripReceiptEmail(riderForEmail.email, {
      name: riderForEmail.name,
      pickup: booking.pickup,
      destination: booking.destination,
      rideType: booking.rideType,
      fare,
      driverName,
      date: new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      bookingId,
    }).catch(() => {});
  }

  return result;
}

export async function cancelBooking(bookingId: string, userId: string, reason?: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  if (isTerminalStatus(booking.status as BookingStatus)) {
    throw new AppError(422, "INVALID_STATE_TRANSITION", `Cannot cancel a ${booking.status} booking`);
  }

  const [updated] = await db.transaction(async (tx) => {
    const [b] = await tx
      .update(schema.bookings)
      .set({
        status: "cancelled",
        cancelledBy: "rider",
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.bookings.id, bookingId))
      .returning();

    // Release driver if assigned
    if (booking.driverId) {
      await tx
        .update(schema.drivers)
        .set({ isAvailable: true, updatedAt: new Date() })
        .where(eq(schema.drivers.id, booking.driverId));
    }

    return [b];
  });

  emitBookingStatusChange(bookingId, "cancelled", { cancelledBy: "rider", reason });

  return updated;
}

export async function rateBooking(bookingId: string, userId: string, input: RateBookingInput) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");
  if (booking.status !== "completed") {
    throw new AppError(422, "INVALID_STATE_TRANSITION", "Can only rate completed bookings");
  }

  // Check if already rated
  const [existing] = await db
    .select()
    .from(schema.ratings)
    .where(eq(schema.ratings.bookingId, bookingId))
    .limit(1);

  if (existing && existing.riderRating) {
    throw new AppError(409, "CONFLICT", "This booking has already been rated");
  }

  if (existing) {
    // Update existing rating record
    const [updated] = await db
      .update(schema.ratings)
      .set({ riderRating: input.rating, riderReview: input.comment, updatedAt: new Date() })
      .where(eq(schema.ratings.bookingId, bookingId))
      .returning();
    return updated;
  }

  const [rating] = await db
    .insert(schema.ratings)
    .values({
      bookingId,
      riderRating: input.rating,
      riderReview: input.comment,
    })
    .returning();

  // Recalculate driver average rating
  if (booking.driverId) {
    const [avgResult] = await db
      .select({ avg: avg(schema.ratings.riderRating) })
      .from(schema.ratings)
      .innerJoin(schema.bookings, eq(schema.ratings.bookingId, schema.bookings.id))
      .where(eq(schema.bookings.driverId, booking.driverId));

    if (avgResult?.avg) {
      await db
        .update(schema.drivers)
        .set({ rating: parseFloat(avgResult.avg).toFixed(1), updatedAt: new Date() })
        .where(eq(schema.drivers.id, booking.driverId));
    }
  }

  return rating;
}

function avg(col: any) {
  return sql<string>`avg(${col})`;
}

import { sql } from "drizzle-orm";

export async function activateSos(bookingId: string, userId: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  await db
    .update(schema.bookings)
    .set({ sosActivated: true, updatedAt: new Date() })
    .where(eq(schema.bookings.id, bookingId));

  const [alert] = await db
    .insert(schema.sosAlerts)
    .values({ bookingId, userId, status: "active" })
    .returning();

  await db.insert(schema.notifications).values({
    userId,
    type: "safety",
    title: "SOS Activated",
    description: "Emergency alert has been sent. Help is on the way.",
  });

  emitSosAlert(bookingId, { userId, status: "active" });

  return alert;
}

export async function shareBooking(bookingId: string, userId: string) {
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .limit(1);

  if (!booking) throw new AppError(404, "NOT_FOUND", "Booking not found");
  if (booking.riderId !== userId) throw new AppError(403, "FORBIDDEN", "Access denied");

  return {
    bookingId: booking.id,
    pickup: booking.pickup,
    destination: booking.destination,
    status: booking.status,
    rideType: booking.rideType,
    shareMessage: `I'm on a ${booking.rideType} ride from ${booking.pickup} to ${booking.destination}. Track my trip on Confluence Ride.`,
  };
}

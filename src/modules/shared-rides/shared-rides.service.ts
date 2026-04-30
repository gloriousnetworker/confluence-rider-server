import { eq, and, ilike, or, desc } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { calculateFare, isPeakHour } from "../../utils/fare.js";

const DEFAULT_DISTANCE_KM = 8.2;
const MAX_RIDERS = 4;

/**
 * Get available shared rides to join (matching route).
 */
export async function getAvailableSharedRides(filters?: { pickup?: string; destination?: string }) {
  const conditions: any[] = [eq(schema.sharedRides.status, "open")];

  if (filters?.pickup) {
    conditions.push(ilike(schema.sharedRides.pickup, `%${filters.pickup}%`));
  }
  if (filters?.destination) {
    conditions.push(ilike(schema.sharedRides.destination, `%${filters.destination}%`));
  }

  const rides = await db
    .select({
      id: schema.sharedRides.id,
      pickup: schema.sharedRides.pickup,
      destination: schema.sharedRides.destination,
      baseFare: schema.sharedRides.baseFare,
      farePerRider: schema.sharedRides.farePerRider,
      maxRiders: schema.sharedRides.maxRiders,
      currentRiders: schema.sharedRides.currentRiders,
      status: schema.sharedRides.status,
      createdAt: schema.sharedRides.createdAt,
      driverName: schema.drivers.name,
      driverRating: schema.drivers.rating,
    })
    .from(schema.sharedRides)
    .leftJoin(schema.drivers, eq(schema.sharedRides.driverId, schema.drivers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.sharedRides.createdAt))
    .limit(20);

  return rides.map((r) => ({
    ...r,
    spotsLeft: r.maxRiders - r.currentRiders,
    savingsPercent: r.currentRiders > 0
      ? Math.round(((r.baseFare - r.farePerRider) / r.baseFare) * 100)
      : Math.round(((MAX_RIDERS - 1) / MAX_RIDERS) * 100), // potential savings
  }));
}

/**
 * Create a new shared ride pool (first rider creates it).
 */
export async function createSharedRide(userId: string, pickup: string, destination: string) {
  const fare = calculateFare({
    rideType: "shared",
    distanceKm: DEFAULT_DISTANCE_KM,
    peakMultiplier: isPeakHour() ? 1.3 : 1.0,
  });

  // Check if there's already an open pool on this route
  const [existing] = await db
    .select()
    .from(schema.sharedRides)
    .where(
      and(
        eq(schema.sharedRides.status, "open"),
        ilike(schema.sharedRides.pickup, `%${pickup}%`),
        ilike(schema.sharedRides.destination, `%${destination}%`)
      )
    )
    .limit(1);

  if (existing) {
    // Join existing pool instead of creating new one
    return joinSharedRide(userId, existing.id);
  }

  // Create booking for this rider
  const [booking] = await db.insert(schema.bookings).values({
    riderId: userId,
    rideType: "shared",
    pickup,
    destination,
    suggestedFare: fare.suggestedFare,
    negotiatedFare: fare.suggestedFare,
    status: "finding",
    estimatedDistanceKm: DEFAULT_DISTANCE_KM.toString(),
    estimatedDurationMins: 15,
  }).returning();

  // Create shared ride pool
  const farePerRider = Math.round(fare.suggestedFare / 1); // starts as full fare for first rider
  const [pool] = await db.insert(schema.sharedRides).values({
    pickup,
    destination,
    route: `${pickup} → ${destination}`,
    baseFare: fare.suggestedFare,
    farePerRider,
    maxRiders: MAX_RIDERS,
    currentRiders: 1,
    status: "open",
  }).returning();

  // Add rider to pool
  await db.insert(schema.sharedRideRiders).values({
    sharedRideId: pool.id,
    riderId: userId,
    bookingId: booking.id,
    fareShare: farePerRider,
  });

  return {
    pool: { ...pool, spotsLeft: MAX_RIDERS - 1 },
    booking,
    farePerRider,
    baseFare: fare.suggestedFare,
    message: "Shared ride created! Waiting for other riders to join.",
  };
}

/**
 * Join an existing shared ride pool.
 */
export async function joinSharedRide(userId: string, poolId: string) {
  const [pool] = await db
    .select()
    .from(schema.sharedRides)
    .where(eq(schema.sharedRides.id, poolId))
    .limit(1);

  if (!pool) throw new AppError(404, "NOT_FOUND", "Shared ride not found");
  if (pool.status !== "open") throw new AppError(422, "POOL_CLOSED", "This shared ride is no longer accepting riders");
  if (pool.currentRiders >= pool.maxRiders) throw new AppError(422, "POOL_FULL", "This shared ride is full");

  // Check if rider already joined
  const [alreadyJoined] = await db
    .select()
    .from(schema.sharedRideRiders)
    .where(and(eq(schema.sharedRideRiders.sharedRideId, poolId), eq(schema.sharedRideRiders.riderId, userId)))
    .limit(1);

  if (alreadyJoined) throw new AppError(409, "CONFLICT", "You already joined this ride");

  const newRiderCount = pool.currentRiders + 1;
  const newFarePerRider = Math.round(pool.baseFare / newRiderCount);

  // Create booking
  const [booking] = await db.insert(schema.bookings).values({
    riderId: userId,
    rideType: "shared",
    pickup: pool.pickup,
    destination: pool.destination,
    suggestedFare: pool.baseFare,
    negotiatedFare: newFarePerRider,
    status: "finding",
    estimatedDistanceKm: "8.2",
    estimatedDurationMins: 15,
    driverId: pool.driverId,
  }).returning();

  await db.transaction(async (tx) => {
    // Add rider to pool
    await tx.insert(schema.sharedRideRiders).values({
      sharedRideId: poolId,
      riderId: userId,
      bookingId: booking.id,
      fareShare: newFarePerRider,
    });

    // Update pool rider count + recalculate fare
    await tx.update(schema.sharedRides).set({
      currentRiders: newRiderCount,
      farePerRider: newFarePerRider,
      status: newRiderCount >= pool.maxRiders ? "full" : "open",
      updatedAt: new Date(),
    }).where(eq(schema.sharedRides.id, poolId));

    // Update all riders' fare shares
    await tx.update(schema.sharedRideRiders).set({
      fareShare: newFarePerRider,
    }).where(eq(schema.sharedRideRiders.sharedRideId, poolId));
  });

  return {
    pool: {
      ...pool,
      currentRiders: newRiderCount,
      farePerRider: newFarePerRider,
      spotsLeft: pool.maxRiders - newRiderCount,
    },
    booking,
    farePerRider: newFarePerRider,
    baseFare: pool.baseFare,
    savings: pool.baseFare - newFarePerRider,
    savingsPercent: Math.round(((pool.baseFare - newFarePerRider) / pool.baseFare) * 100),
    message: `Joined! You save ₦${pool.baseFare - newFarePerRider} (${Math.round(((pool.baseFare - newFarePerRider) / pool.baseFare) * 100)}% off)`,
  };
}

/**
 * Get details of a shared ride pool including all co-riders.
 */
export async function getSharedRideDetails(poolId: string, userId: string) {
  const [pool] = await db
    .select()
    .from(schema.sharedRides)
    .where(eq(schema.sharedRides.id, poolId))
    .limit(1);

  if (!pool) throw new AppError(404, "NOT_FOUND", "Shared ride not found");

  // Get all riders in this pool
  const riders = await db
    .select({
      id: schema.sharedRideRiders.id,
      riderId: schema.sharedRideRiders.riderId,
      fareShare: schema.sharedRideRiders.fareShare,
      joinedAt: schema.sharedRideRiders.joinedAt,
      riderName: schema.users.name,
    })
    .from(schema.sharedRideRiders)
    .innerJoin(schema.users, eq(schema.sharedRideRiders.riderId, schema.users.id))
    .where(eq(schema.sharedRideRiders.sharedRideId, poolId));

  // Get driver info
  let driver = null;
  if (pool.driverId) {
    const [d] = await db
      .select({ name: schema.drivers.name, rating: schema.drivers.rating, vehicleType: schema.drivers.vehicleType })
      .from(schema.drivers)
      .where(eq(schema.drivers.id, pool.driverId))
      .limit(1);
    driver = d;
  }

  return {
    ...pool,
    spotsLeft: pool.maxRiders - pool.currentRiders,
    riders: riders.map((r) => ({
      ...r,
      riderName: r.riderId === userId ? `${r.riderName} (You)` : r.riderName?.charAt(0) + "***",
    })),
    driver,
    savingsPercent: pool.currentRiders > 1
      ? Math.round(((pool.baseFare - pool.farePerRider) / pool.baseFare) * 100)
      : 0,
  };
}

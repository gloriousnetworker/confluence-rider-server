import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../config/database.js";
import * as schema from "../db/schema/index.js";
import { LANDMARK_COORDS } from "./dispatch-geo.js";

/**
 * AI Dispatch — Smart Driver Assignment
 *
 * Scores each available driver on multiple factors:
 * 1. Proximity (distance to pickup) — 40% weight
 * 2. Rating — 25% weight
 * 3. Experience (trip count) — 15% weight
 * 4. Vehicle match — 10% weight
 * 5. Acceptance rate (recent cancellations) — 10% weight
 *
 * Returns drivers sorted by score (best first).
 */

interface DispatchInput {
  pickup: string;
  destination: string;
  rideType: string;
  riderId: string;
}

interface ScoredDriver {
  id: string;
  name: string;
  phone: string;
  rating: string;
  totalTrips: number;
  zone: string;
  vehicleType: string;
  score: number;
  breakdown: {
    proximityScore: number;
    ratingScore: number;
    experienceScore: number;
    vehicleMatchScore: number;
    acceptanceScore: number;
  };
  estimatedArrivalMins: number;
  counterFare: number;
}

// Vehicle type compatibility
const RIDE_TO_VEHICLE: Record<string, string[]> = {
  bike: ["bike"],
  keke: ["keke"],
  cab: ["car"],
  shared: ["car"],
  intercity: ["car"],
  campus: ["keke", "car"],
  delivery: ["bike", "keke", "car"],
};

// Scoring weights
const WEIGHTS = {
  proximity: 0.40,
  rating: 0.25,
  experience: 0.15,
  vehicleMatch: 0.10,
  acceptance: 0.10,
};

/**
 * Calculate distance between two points using Haversine formula.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get coordinates for a location name.
 */
function getCoords(name: string): [number, number] {
  if (LANDMARK_COORDS[name]) return LANDMARK_COORDS[name];
  // Partial match
  const key = Object.keys(LANDMARK_COORDS).find((k) =>
    k.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(k.toLowerCase())
  );
  if (key) return LANDMARK_COORDS[key];
  // Default Lokoja center
  return [7.7969, 6.7433];
}

/**
 * Score a driver for a given ride request.
 */
function scoreDriver(
  driver: any,
  pickupCoords: [number, number],
  rideType: string,
  recentCancellations: number
): { score: number; breakdown: any; estimatedArrivalMins: number } {
  const vehicleTypes = RIDE_TO_VEHICLE[rideType] || ["car"];

  // 1. Proximity Score (0-100)
  // Use driver's current location or zone-based estimate
  const driverLat = driver.currentLocationLat ? parseFloat(driver.currentLocationLat) : getCoords(driver.zone)[0];
  const driverLng = driver.currentLocationLng ? parseFloat(driver.currentLocationLng) : getCoords(driver.zone)[1];
  const distanceKm = haversineKm(pickupCoords[0], pickupCoords[1], driverLat, driverLng);
  const proximityScore = Math.max(0, 100 - distanceKm * 10); // 10km = 0 score

  // 2. Rating Score (0-100)
  const rating = parseFloat(driver.rating) || 5.0;
  const ratingScore = (rating / 5) * 100;

  // 3. Experience Score (0-100)
  const trips = driver.totalTrips || 0;
  const experienceScore = Math.min(100, (trips / 500) * 100); // 500+ trips = max

  // 4. Vehicle Match Score (0 or 100)
  const vehicleMatchScore = vehicleTypes.includes(driver.vehicleType) ? 100 : 0;

  // 5. Acceptance Score (0-100) — penalize recent cancellations
  const acceptanceScore = Math.max(0, 100 - recentCancellations * 20);

  // Weighted total
  const score =
    proximityScore * WEIGHTS.proximity +
    ratingScore * WEIGHTS.rating +
    experienceScore * WEIGHTS.experience +
    vehicleMatchScore * WEIGHTS.vehicleMatch +
    acceptanceScore * WEIGHTS.acceptance;

  // Estimated arrival based on distance (assume 30km/h average in city)
  const estimatedArrivalMins = Math.max(2, Math.round((distanceKm / 30) * 60));

  return {
    score: Math.round(score * 10) / 10,
    breakdown: {
      proximityScore: Math.round(proximityScore),
      ratingScore: Math.round(ratingScore),
      experienceScore: Math.round(experienceScore),
      vehicleMatchScore: Math.round(vehicleMatchScore),
      acceptanceScore: Math.round(acceptanceScore),
    },
    estimatedArrivalMins,
  };
}

/**
 * AI Dispatch: find and rank the best drivers for a ride.
 */
export async function dispatchDrivers(input: DispatchInput): Promise<ScoredDriver[]> {
  const pickupCoords = getCoords(input.pickup);

  // Get all online + available + verified drivers
  const drivers = await db
    .select()
    .from(schema.drivers)
    .where(
      and(
        eq(schema.drivers.isOnline, true),
        eq(schema.drivers.isAvailable, true),
        eq(schema.drivers.isVerified, true)
      )
    );

  if (drivers.length === 0) return [];

  // Get recent cancellation counts per driver (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cancellations = await db
    .select({
      driverId: schema.bookings.driverId,
      cancelCount: sql<number>`COUNT(*)`,
    })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.status, "cancelled"),
        sql`${schema.bookings.createdAt} >= ${sevenDaysAgo.toISOString()}`
      )
    )
    .groupBy(schema.bookings.driverId);

  const cancelMap = new Map(cancellations.map((c) => [c.driverId, Number(c.cancelCount)]));

  // Score each driver
  const vehicleTypes = RIDE_TO_VEHICLE[input.rideType] || ["car"];
  const scored: ScoredDriver[] = drivers
    .filter((d) => vehicleTypes.includes(d.vehicleType)) // must match vehicle
    .map((driver) => {
      const recentCancels = cancelMap.get(driver.id) || 0;
      const { score, breakdown, estimatedArrivalMins } = scoreDriver(driver, pickupCoords, input.rideType, recentCancels);

      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        rating: driver.rating,
        totalTrips: driver.totalTrips,
        zone: driver.zone,
        vehicleType: driver.vehicleType,
        score,
        breakdown,
        estimatedArrivalMins,
        counterFare: 0, // will be set by the booking service
      };
    })
    .sort((a, b) => b.score - a.score); // best first

  return scored;
}

/**
 * Get demand heatmap for a time period.
 * Shows which areas have the most ride requests.
 */
export async function getDemandHeatmap() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const demand = await db
    .select({
      pickup: schema.bookings.pickup,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.bookings)
    .where(sql`${schema.bookings.createdAt} >= ${twentyFourHoursAgo.toISOString()}`)
    .groupBy(schema.bookings.pickup)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

  return demand.map((d) => ({
    location: d.pickup,
    requests: Number(d.count),
    coordinates: getCoords(d.pickup),
  }));
}

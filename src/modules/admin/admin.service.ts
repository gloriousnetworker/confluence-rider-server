import { eq, and, count, ilike, or, desc, sql } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { getOffset, buildPaginationMeta } from "../../utils/pagination.js";

// ─── Users ───
export async function listUsers(filters: { role?: string; search?: string; page: number; limit: number }) {
  const conditions: any[] = [];

  if (filters.role) {
    conditions.push(eq(schema.users.role, filters.role as any));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(ilike(schema.users.name, pattern), ilike(schema.users.phone, pattern)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ total: count() }).from(schema.users).where(whereClause);
  const total = totalResult?.total ?? 0;

  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      email: schema.users.email,
      role: schema.users.role,
      memberStatus: schema.users.memberStatus,
      isPhoneVerified: schema.users.isPhoneVerified,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(whereClause)
    .orderBy(desc(schema.users.createdAt))
    .limit(filters.limit)
    .offset(getOffset(filters.page, filters.limit));

  return { users, meta: buildPaginationMeta(filters.page, filters.limit, total) };
}

// ─── Drivers ───
export async function listDrivers(filters: { status?: string; page: number; limit: number }) {
  const conditions: any[] = [];
  if (filters.status) {
    conditions.push(eq(schema.drivers.verificationStatus, filters.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ total: count() }).from(schema.drivers).where(whereClause);
  const total = totalResult?.total ?? 0;

  const drivers = await db
    .select({
      id: schema.drivers.id,
      name: schema.drivers.name,
      phone: schema.drivers.phone,
      rating: schema.drivers.rating,
      totalTrips: schema.drivers.totalTrips,
      zone: schema.drivers.zone,
      vehicleType: schema.drivers.vehicleType,
      vehicleModel: schema.drivers.vehicleModel,
      vehicleColor: schema.drivers.vehicleColor,
      plateNumber: schema.drivers.plateNumber,
      licenseNumber: schema.drivers.licenseNumber,
      verificationStatus: schema.drivers.verificationStatus,
      isOnline: schema.drivers.isOnline,
      isAvailable: schema.drivers.isAvailable,
      createdAt: schema.drivers.createdAt,
    })
    .from(schema.drivers)
    .where(whereClause)
    .orderBy(desc(schema.drivers.createdAt))
    .limit(filters.limit)
    .offset(getOffset(filters.page, filters.limit));

  return { drivers, meta: buildPaginationMeta(filters.page, filters.limit, total) };
}

export async function approveDriver(driverId: string, status: "approved" | "rejected") {
  const [driver] = await db.select().from(schema.drivers).where(eq(schema.drivers.id, driverId)).limit(1);
  if (!driver) throw new AppError(404, "NOT_FOUND", "Driver not found");

  const [updated] = await db
    .update(schema.drivers)
    .set({
      verificationStatus: status,
      isVerified: status === "approved",
      updatedAt: new Date(),
    })
    .where(eq(schema.drivers.id, driverId))
    .returning();

  return updated;
}

// ─── Rides ───
export async function listRides(filters: { status?: string; page: number; limit: number }) {
  const conditions: any[] = [];
  if (filters.status) {
    conditions.push(eq(schema.bookings.status, filters.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ total: count() }).from(schema.bookings).where(whereClause);
  const total = totalResult?.total ?? 0;

  const rides = await db
    .select({
      id: schema.bookings.id,
      rideType: schema.bookings.rideType,
      pickup: schema.bookings.pickup,
      destination: schema.bookings.destination,
      suggestedFare: schema.bookings.suggestedFare,
      finalFare: schema.bookings.finalFare,
      status: schema.bookings.status,
      sosActivated: schema.bookings.sosActivated,
      createdAt: schema.bookings.createdAt,
      completedAt: schema.bookings.completedAt,
      riderName: schema.users.name,
      driverName: schema.drivers.name,
    })
    .from(schema.bookings)
    .leftJoin(schema.users, eq(schema.bookings.riderId, schema.users.id))
    .leftJoin(schema.drivers, eq(schema.bookings.driverId, schema.drivers.id))
    .where(whereClause)
    .orderBy(desc(schema.bookings.createdAt))
    .limit(filters.limit)
    .offset(getOffset(filters.page, filters.limit));

  return { rides, meta: buildPaginationMeta(filters.page, filters.limit, total) };
}

// ─── Analytics ───
export async function getAnalytics() {
  const [totalUsers] = await db.select({ total: count() }).from(schema.users);
  const [totalRiders] = await db.select({ total: count() }).from(schema.users).where(eq(schema.users.role, "rider"));
  const [totalDrivers] = await db.select({ total: count() }).from(schema.drivers);
  const [onlineDrivers] = await db.select({ total: count() }).from(schema.drivers).where(eq(schema.drivers.isOnline, true));
  const [totalRides] = await db.select({ total: count() }).from(schema.bookings);
  const [completedRides] = await db.select({ total: count() }).from(schema.bookings).where(eq(schema.bookings.status, "completed"));
  const [cancelledRides] = await db.select({ total: count() }).from(schema.bookings).where(eq(schema.bookings.status, "cancelled"));
  const [pendingKyc] = await db.select({ total: count() }).from(schema.drivers).where(eq(schema.drivers.verificationStatus, "pending"));
  const [activeSos] = await db.select({ total: count() }).from(schema.sosAlerts).where(eq(schema.sosAlerts.status, "active"));

  // GMV: sum of finalFare for completed rides
  const [gmvResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${schema.bookings.finalFare}), 0)` })
    .from(schema.bookings)
    .where(eq(schema.bookings.status, "completed"));

  const completionRate = totalRides.total > 0
    ? Math.round((completedRides.total / totalRides.total) * 100)
    : 0;

  return {
    totalUsers: totalUsers.total,
    totalRiders: totalRiders.total,
    totalDrivers: totalDrivers.total,
    onlineDrivers: onlineDrivers.total,
    totalRides: totalRides.total,
    completedRides: completedRides.total,
    cancelledRides: cancelledRides.total,
    completionRate,
    pendingKyc: pendingKyc.total,
    activeSos: activeSos.total,
    gmv: Number(gmvResult.total),
  };
}

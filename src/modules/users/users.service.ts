import { eq, and, count, avg, sql } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import type { UpdateProfileInput, CreateSavedPlaceInput } from "./users.schema.js";

export async function getProfile(userId: string) {
  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      email: schema.users.email,
      role: schema.users.role,
      memberStatus: schema.users.memberStatus,
      language: schema.users.language,
      avatarUrl: schema.users.avatarUrl,
      dateOfBirth: schema.users.dateOfBirth,
      profileLevel: schema.users.profileLevel,
      isPhoneVerified: schema.users.isPhoneVerified,
      is2faEnabled: schema.users.is2faEnabled,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.email) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, input.email)))
      .limit(1);

    if (existing && existing.id !== userId) {
      throw new AppError(409, "CONFLICT", "Email already in use");
    }
  }

  // Calculate profile level after update
  const [currentUser] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const merged = { ...currentUser, ...input };
  let profileLevel = "incomplete";
  if (merged.name && merged.avatarUrl && (merged as any).dateOfBirth) {
    profileLevel = "level1"; // Level 1: name + photo + DOB
  }

  const [updated] = await db
    .update(schema.users)
    .set({ ...input, profileLevel, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      email: schema.users.email,
      role: schema.users.role,
      memberStatus: schema.users.memberStatus,
      language: schema.users.language,
      avatarUrl: schema.users.avatarUrl,
    });

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  return updated;
}

export async function getStats(userId: string) {
  // Total completed trips
  const [tripCount] = await db
    .select({ total: count() })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.riderId, userId),
        eq(schema.bookings.status, "completed")
      )
    );

  // Average rating received (from ratings.driverRating where user is rider)
  const [avgRating] = await db
    .select({ average: avg(schema.ratings.riderRating) })
    .from(schema.ratings)
    .innerJoin(schema.bookings, eq(schema.ratings.bookingId, schema.bookings.id))
    .where(
      and(
        eq(schema.bookings.riderId, userId),
        sql`${schema.ratings.riderRating} IS NOT NULL`
      )
    );

  // Referral count
  const [refCount] = await db
    .select({ total: count() })
    .from(schema.referrals)
    .where(eq(schema.referrals.referrerId, userId));

  return {
    totalTrips: tripCount?.total ?? 0,
    averageRating: avgRating?.average ? parseFloat(avgRating.average) : 0,
    referralsCount: refCount?.total ?? 0,
  };
}

export async function getSavedPlaces(userId: string) {
  return db
    .select()
    .from(schema.savedPlaces)
    .where(eq(schema.savedPlaces.userId, userId))
    .orderBy(schema.savedPlaces.label);
}

export async function createSavedPlace(userId: string, input: CreateSavedPlaceInput) {
  // Check uniqueness for non-'other' labels
  if (input.label !== "other") {
    const [existing] = await db
      .select()
      .from(schema.savedPlaces)
      .where(
        and(
          eq(schema.savedPlaces.userId, userId),
          eq(schema.savedPlaces.label, input.label)
        )
      )
      .limit(1);

    if (existing) {
      throw new AppError(
        409,
        "CONFLICT",
        `You already have a '${input.label}' saved place. Delete it first or use a different label.`
      );
    }
  }

  const [place] = await db
    .insert(schema.savedPlaces)
    .values({ userId, ...input })
    .returning();

  return place;
}

export async function deleteSavedPlace(userId: string, placeId: string) {
  const [place] = await db
    .select()
    .from(schema.savedPlaces)
    .where(eq(schema.savedPlaces.id, placeId))
    .limit(1);

  if (!place) {
    throw new AppError(404, "NOT_FOUND", "Saved place not found");
  }

  if (place.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You can only delete your own saved places");
  }

  await db.delete(schema.savedPlaces).where(eq(schema.savedPlaces.id, placeId));

  return { message: "Saved place deleted" };
}

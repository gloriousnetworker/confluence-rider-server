import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";

/**
 * Generate a deterministic referral code from user data.
 * Format: first 4 letters of name (uppercase) + "-" + short id
 */
function generateReferralCode(name: string, id: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, "").substring(0, 4).toUpperCase();
  const suffix = id.substring(0, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

export async function getReferralCode(userId: string) {
  const [user] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

  const code = generateReferralCode(user.name, user.id);

  return {
    code,
    shareUrl: `https://confluenceride.ng/refer/${code}`,
    shareMessage: `Join Confluence Ride with my code ${code} and get a bonus on your first trip! Move Kogi Better.`,
  };
}

export async function applyReferral(referredUserId: string, referralCode: string) {
  // Find the referrer by matching their code pattern
  const users = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users);

  const referrer = users.find((u) => {
    const code = generateReferralCode(u.name, u.id);
    return code === referralCode.toUpperCase();
  });

  if (!referrer) {
    throw new AppError(404, "NOT_FOUND", "Invalid referral code");
  }

  if (referrer.id === referredUserId) {
    throw new AppError(422, "SELF_REFERRAL", "You cannot refer yourself");
  }

  // Check if user was already referred
  const [existing] = await db
    .select()
    .from(schema.referrals)
    .where(eq(schema.referrals.referredUserId, referredUserId))
    .limit(1);

  if (existing) {
    throw new AppError(409, "CONFLICT", "You have already been referred");
  }

  const [referral] = await db
    .insert(schema.referrals)
    .values({
      referrerId: referrer.id,
      referredUserId,
      bonusAmount: 500,
      status: "pending",
    })
    .returning();

  return {
    message: "Referral applied! You'll both get ₦500 after your first completed trip.",
    referral,
  };
}

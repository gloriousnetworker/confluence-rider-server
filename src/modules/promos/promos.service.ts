import { eq, and } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";

export async function validatePromo(userId: string, code: string) {
  const [promo] = await db
    .select()
    .from(schema.promoCodes)
    .where(eq(schema.promoCodes.code, code.toUpperCase()))
    .limit(1);

  if (!promo) {
    throw new AppError(404, "NOT_FOUND", "Promo code not found");
  }

  if (!promo.isActive) {
    throw new AppError(422, "PROMO_INACTIVE", "This promo code is no longer active");
  }

  if (new Date() > promo.expiresAt) {
    throw new AppError(422, "PROMO_EXPIRED", "This promo code has expired");
  }

  if (promo.usageLimit && promo.timesUsed >= promo.usageLimit) {
    throw new AppError(422, "PROMO_LIMIT_REACHED", "This promo code has reached its usage limit");
  }

  // Check if user already used this promo
  const [usage] = await db
    .select()
    .from(schema.promoUsages)
    .where(
      and(
        eq(schema.promoUsages.promoId, promo.id),
        eq(schema.promoUsages.userId, userId)
      )
    )
    .limit(1);

  if (usage) {
    throw new AppError(409, "PROMO_ALREADY_USED", "You have already used this promo code");
  }

  return {
    valid: true,
    code: promo.code,
    discountPercent: promo.discountPercent,
  };
}

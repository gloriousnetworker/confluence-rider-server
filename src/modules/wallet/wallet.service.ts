import { eq, and, count, sum, sql, desc } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { getOffset, buildPaginationMeta } from "../../utils/pagination.js";
import type { TopupInput } from "./wallet.schema.js";

export async function getWallet(userId: string) {
  const [wallet] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.userId, userId))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "NOT_FOUND", "Wallet not found");
  }

  return { balance: wallet.balance, currency: "NGN" };
}

export async function topup(userId: string, input: TopupInput) {
  const [wallet] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.userId, userId))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "NOT_FOUND", "Wallet not found");
  }

  // For MVP: instantly credit wallet (in prod, this would go through Paystack)
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.wallets)
      .set({ balance: wallet.balance + input.amount, updatedAt: new Date() })
      .where(eq(schema.wallets.id, wallet.id))
      .returning();

    await tx.insert(schema.transactions).values({
      walletId: wallet.id,
      userId,
      type: "credit",
      amount: input.amount,
      description: `Wallet top-up via ${input.paymentMethod}`,
      reference: `TXN-${Date.now()}`,
    });

    return updated;
  });

  return { balance: result.balance, currency: "NGN" };
}

export async function getTransactions(
  userId: string,
  filters: { type?: string; page: number; limit: number }
) {
  const [wallet] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.userId, userId))
    .limit(1);

  if (!wallet) {
    throw new AppError(404, "NOT_FOUND", "Wallet not found");
  }

  const conditions = [eq(schema.transactions.walletId, wallet.id)];
  if (filters.type) {
    conditions.push(eq(schema.transactions.type, filters.type as "debit" | "credit"));
  }

  const [totalResult] = await db
    .select({ total: count() })
    .from(schema.transactions)
    .where(and(...conditions));

  const total = totalResult?.total ?? 0;
  const offset = getOffset(filters.page, filters.limit);

  const txns = await db
    .select({
      id: schema.transactions.id,
      type: schema.transactions.type,
      amount: schema.transactions.amount,
      description: schema.transactions.description,
      reference: schema.transactions.reference,
      createdAt: schema.transactions.createdAt,
    })
    .from(schema.transactions)
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.createdAt))
    .limit(filters.limit)
    .offset(offset);

  return {
    transactions: txns,
    meta: buildPaginationMeta(filters.page, filters.limit, total),
  };
}

export async function getSavings(userId: string) {
  // Monthly savings: sum of (suggestedFare - finalFare) for completed trips this month
  // where the rider paid less than suggested
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [result] = await db
    .select({
      savings: sql<number>`COALESCE(SUM(${schema.bookings.suggestedFare} - ${schema.bookings.finalFare}), 0)`,
    })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.riderId, userId),
        eq(schema.bookings.status, "completed"),
        sql`${schema.bookings.finalFare} < ${schema.bookings.suggestedFare}`,
        sql`${schema.bookings.completedAt} >= ${startOfMonth.toISOString()}`
      )
    );

  return {
    monthlySavings: Number(result?.savings ?? 0),
    currency: "NGN",
  };
}

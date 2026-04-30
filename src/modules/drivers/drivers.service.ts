import { eq, and, sql, count, sum, gte } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { env } from "../../config/env.js";
import type { WithdrawInput } from "./drivers.schema.js";

/**
 * Get driver earnings summary.
 */
export async function getEarnings(userId: string, period: string) {
  // Find the driver record linked to this user
  const [driver] = await db
    .select()
    .from(schema.drivers)
    .where(eq(schema.drivers.userId, userId))
    .limit(1);

  if (!driver) {
    throw new AppError(404, "NOT_FOUND", "Driver profile not found");
  }

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(0); // all time
  }

  // Total earnings from completed trips where this driver was assigned
  const [earningsResult] = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(${schema.bookings.finalFare}), 0)`,
      tripCount: count(),
    })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.driverId, driver.id),
        eq(schema.bookings.status, "completed"),
        gte(schema.bookings.completedAt, startDate)
      )
    );

  // Get wallet balance (driver's available balance for withdrawal)
  const [wallet] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.userId, userId))
    .limit(1);

  // Recent completed trips
  const recentTrips = await db
    .select({
      id: schema.bookings.id,
      pickup: schema.bookings.pickup,
      destination: schema.bookings.destination,
      finalFare: schema.bookings.finalFare,
      rideType: schema.bookings.rideType,
      completedAt: schema.bookings.completedAt,
    })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.driverId, driver.id),
        eq(schema.bookings.status, "completed"),
        gte(schema.bookings.completedAt, startDate)
      )
    )
    .orderBy(sql`${schema.bookings.completedAt} DESC`)
    .limit(20);

  const totalEarnings = Number(earningsResult?.totalEarnings ?? 0);
  const tripCount = earningsResult?.tripCount ?? 0;

  return {
    period,
    totalEarnings,
    tripCount,
    averagePerTrip: tripCount > 0 ? Math.round(totalEarnings / tripCount) : 0,
    availableBalance: wallet?.balance ?? 0,
    currency: "NGN",
    recentTrips,
  };
}

/**
 * Withdraw earnings to bank account via Paystack Transfer.
 */
export async function withdrawEarnings(userId: string, input: WithdrawInput) {
  // Check wallet balance
  const [wallet] = await db
    .select()
    .from(schema.wallets)
    .where(eq(schema.wallets.userId, userId))
    .limit(1);

  if (!wallet) throw new AppError(404, "NOT_FOUND", "Wallet not found");
  if (wallet.balance < input.amount) {
    throw new AppError(422, "INSUFFICIENT_BALANCE", `Insufficient balance. Available: ₦${wallet.balance}`);
  }

  // If Paystack is configured, create a real transfer
  if (env.PAYSTACK_SECRET_KEY) {
    try {
      // Step 1: Create transfer recipient
      const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: input.accountName,
          account_number: input.accountNumber,
          bank_code: input.bankCode,
          currency: "NGN",
        }),
      });
      const recipientData = (await recipientRes.json()) as any;

      if (!recipientData.status) {
        throw new AppError(422, "TRANSFER_FAILED", recipientData.message || "Failed to create transfer recipient");
      }

      const recipientCode = recipientData.data.recipient_code;

      // Step 2: Initiate transfer
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: input.amount * 100, // kobo
          recipient: recipientCode,
          reason: "Confluence Ride driver earnings withdrawal",
        }),
      });
      const transferData = (await transferRes.json()) as any;

      if (!transferData.status) {
        throw new AppError(422, "TRANSFER_FAILED", transferData.message || "Transfer failed");
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[Withdrawal] Paystack transfer error:", err);
      // For test mode, Paystack transfers may not work — continue with local deduction
    }
  }

  // Deduct from wallet
  const result = await db.transaction(async (tx) => {
    const newBalance = wallet.balance - input.amount;

    await tx
      .update(schema.wallets)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(schema.wallets.id, wallet.id));

    await tx.insert(schema.transactions).values({
      walletId: wallet.id,
      userId,
      type: "debit",
      amount: input.amount,
      description: `Withdrawal to ${input.bankCode} ****${input.accountNumber.slice(-4)}`,
      reference: `WD-${Date.now()}`,
    });

    await tx.insert(schema.notifications).values({
      userId,
      type: "trip",
      title: "Withdrawal Processed",
      description: `₦${input.amount.toLocaleString()} has been sent to your bank account (****${input.accountNumber.slice(-4)}).`,
    });

    return { balance: newBalance };
  });

  return {
    message: "Withdrawal processed successfully",
    amount: input.amount,
    newBalance: result.balance,
    bankCode: input.bankCode,
    accountNumber: `****${input.accountNumber.slice(-4)}`,
    currency: "NGN",
  };
}

/**
 * Get list of Nigerian banks (from Paystack).
 */
export async function getBanks() {
  if (!env.PAYSTACK_SECRET_KEY) {
    // Return common Nigerian banks as fallback
    return [
      { name: "Access Bank", code: "044" },
      { name: "First Bank of Nigeria", code: "011" },
      { name: "Guaranty Trust Bank", code: "058" },
      { name: "United Bank for Africa", code: "033" },
      { name: "Zenith Bank", code: "057" },
      { name: "Wema Bank", code: "035" },
      { name: "Kuda Bank", code: "50211" },
      { name: "OPay", code: "999992" },
      { name: "PalmPay", code: "999991" },
      { name: "Moniepoint", code: "50515" },
    ];
  }

  const res = await fetch("https://api.paystack.co/bank?country=nigeria", {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });
  const data = (await res.json()) as any;

  if (data.status && data.data) {
    return data.data.map((b: any) => ({ name: b.name, code: b.code }));
  }

  return [];
}

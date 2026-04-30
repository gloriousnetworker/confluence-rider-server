import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { successResponse } from "../../utils/api-response.js";
import { AppError } from "../../middleware/error-handler.js";
import { env } from "../../config/env.js";
import { sendTopupConfirmationEmail } from "../../services/email.js";
import {
  initializeTransaction,
  verifyTransaction,
  validateWebhookSignature,
} from "../../services/paystack.js";
import { initializePaymentSchema, verifyPaymentSchema } from "./payments.schema.js";

export const paymentsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/payments/initialize — Start a Paystack payment
  typedApp.post(
    "/initialize",
    {
      schema: {
        body: initializePaymentSchema,
        tags: ["Payments"],
        summary: "Initialize a Paystack payment for wallet topup",
      },
      preHandler: [authenticate],
    },
    async (request, reply) => {
      if (!env.PAYSTACK_SECRET_KEY) {
        throw new AppError(503, "SERVICE_UNAVAILABLE", "Payment service not configured");
      }

      const { amount } = request.body;
      const userId = request.user.sub;

      // Get user email (Paystack requires email)
      const [user] = await db
        .select({ email: schema.users.email, phone: schema.users.phone })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      const email = user?.email || `${user?.phone}@confluenceride.ng`;
      const reference = `CR-${nanoid(16)}`;

      const result = await initializeTransaction({
        email,
        amount: amount * 100, // Convert Naira to kobo
        reference,
        metadata: {
          userId,
          type: "wallet_topup",
          amountNaira: amount,
        },
      });

      // Store pending payment
      const [wallet] = await db
        .select()
        .from(schema.wallets)
        .where(eq(schema.wallets.userId, userId))
        .limit(1);

      if (wallet) {
        await db.insert(schema.payments).values({
          bookingId: null as any, // wallet topup, not ride payment
          amount,
          method: "card",
          status: "pending",
          transactionRef: reference,
        });
      }

      return reply.status(201).send(successResponse({
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference,
        publicKey: env.PAYSTACK_PUBLIC_KEY,
      }));
    }
  );

  // POST /api/payments/verify — Verify payment after redirect
  typedApp.post(
    "/verify",
    {
      schema: {
        body: verifyPaymentSchema,
        tags: ["Payments"],
        summary: "Verify a Paystack payment and credit wallet",
      },
      preHandler: [authenticate],
    },
    async (request) => {
      if (!env.PAYSTACK_SECRET_KEY) {
        throw new AppError(503, "SERVICE_UNAVAILABLE", "Payment service not configured");
      }

      const { reference } = request.body;
      const userId = request.user.sub;

      const txn = await verifyTransaction(reference);

      if (txn.status !== "success") {
        // Update payment record
        await db
          .update(schema.payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(schema.payments.transactionRef, reference));

        throw new AppError(422, "PAYMENT_FAILED", `Payment ${txn.status}`);
      }

      // Credit wallet
      const result = await db.transaction(async (tx) => {
        const [wallet] = await tx
          .select()
          .from(schema.wallets)
          .where(eq(schema.wallets.userId, userId))
          .limit(1);

        if (!wallet) throw new AppError(404, "NOT_FOUND", "Wallet not found");

        // Check if already credited (idempotency)
        const [existingTxn] = await tx
          .select()
          .from(schema.transactions)
          .where(eq(schema.transactions.reference, reference))
          .limit(1);

        if (existingTxn) {
          return { balance: wallet.balance, alreadyCredited: true };
        }

        const newBalance = wallet.balance + txn.amount;

        await tx
          .update(schema.wallets)
          .set({ balance: newBalance, updatedAt: new Date() })
          .where(eq(schema.wallets.id, wallet.id));

        await tx.insert(schema.transactions).values({
          walletId: wallet.id,
          userId,
          type: "credit",
          amount: txn.amount,
          description: `Wallet top-up via ${txn.channel}`,
          reference,
        });

        // Update payment record
        await tx
          .update(schema.payments)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(schema.payments.transactionRef, reference));

        return { balance: newBalance, alreadyCredited: false };
      });

      // Send topup confirmation email (non-blocking)
      if (!result.alreadyCredited) {
        const [userForEmail] = await db
          .select({ email: schema.users.email, name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);

        if (userForEmail?.email) {
          sendTopupConfirmationEmail(userForEmail.email, userForEmail.name, txn.amount, result.balance).catch(() => {});
        }
      }

      return successResponse({
        message: result.alreadyCredited ? "Payment already credited" : "Payment successful! Wallet credited.",
        balance: result.balance,
        amount: txn.amount,
        reference: txn.reference,
        currency: "NGN",
      });
    }
  );

  // POST /api/payments/webhook — Paystack webhook (no auth — validated by signature)
  app.post(
    "/webhook",
    {
      config: { rawBody: true },
      schema: { tags: ["Payments"], summary: "Paystack webhook endpoint" },
    },
    async (request, reply) => {
      const signature = request.headers["x-paystack-signature"] as string;
      const rawBody = JSON.stringify(request.body);

      if (!validateWebhookSignature(rawBody, signature || "")) {
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const event = request.body as any;

      if (event.event === "charge.success") {
        const data = event.data;
        const reference = data.reference;
        const userId = data.metadata?.userId;
        const amount = data.amount / 100; // kobo to Naira

        if (userId) {
          try {
            const [wallet] = await db
              .select()
              .from(schema.wallets)
              .where(eq(schema.wallets.userId, userId))
              .limit(1);

            if (wallet) {
              // Check idempotency
              const [existing] = await db
                .select()
                .from(schema.transactions)
                .where(eq(schema.transactions.reference, reference))
                .limit(1);

              if (!existing) {
                await db.transaction(async (tx) => {
                  await tx
                    .update(schema.wallets)
                    .set({ balance: wallet.balance + amount, updatedAt: new Date() })
                    .where(eq(schema.wallets.id, wallet.id));

                  await tx.insert(schema.transactions).values({
                    walletId: wallet.id,
                    userId,
                    type: "credit",
                    amount,
                    description: `Wallet top-up via ${data.channel}`,
                    reference,
                  });
                });
              }
            }
          } catch (err) {
            console.error("[Webhook] Error processing payment:", err);
          }
        }
      }

      return reply.status(200).send({ received: true });
    }
  );

  // GET /api/payments/config — Get Paystack public key for frontend
  typedApp.get(
    "/config",
    {
      schema: { tags: ["Payments"], summary: "Get payment gateway config" },
    },
    async () => {
      return successResponse({
        publicKey: env.PAYSTACK_PUBLIC_KEY || null,
        enabled: !!env.PAYSTACK_SECRET_KEY,
      });
    }
  );
};

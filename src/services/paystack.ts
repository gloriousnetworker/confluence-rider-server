import { env } from "../config/env.js";
import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackRequest(path: string, method = "GET", body?: any) {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return (await response.json()) as Record<string, any>;
}

/**
 * Initialize a Paystack transaction.
 * Returns an authorization URL that the frontend opens for payment.
 */
export async function initializeTransaction(params: {
  email: string;
  amount: number; // in kobo (₦100 = 10000 kobo)
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}) {
  const data = await paystackRequest("/transaction/initialize", "POST", {
    email: params.email,
    amount: params.amount,
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
  });

  if (!data.status) {
    throw new Error(data.message || "Failed to initialize Paystack transaction");
  }

  return {
    authorizationUrl: data.data.authorization_url as string,
    accessCode: data.data.access_code as string,
    reference: data.data.reference as string,
  };
}

/**
 * Verify a Paystack transaction by reference.
 */
export async function verifyTransaction(reference: string) {
  const data = await paystackRequest(`/transaction/verify/${reference}`);

  if (!data.status) {
    throw new Error(data.message || "Failed to verify transaction");
  }

  return {
    status: data.data.status as string, // "success", "failed", "abandoned"
    amount: (data.data.amount as number) / 100, // Convert from kobo to Naira
    reference: data.data.reference as string,
    channel: data.data.channel as string, // "card", "bank", "ussd"
    paidAt: data.data.paid_at as string,
    metadata: data.data.metadata as Record<string, any>,
  };
}

/**
 * Validate Paystack webhook signature.
 */
export function validateWebhookSignature(body: string, signature: string): boolean {
  if (!env.PAYSTACK_SECRET_KEY) return false;
  const hash = crypto
    .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");
  return hash === signature;
}

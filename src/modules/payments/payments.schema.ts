import { z } from "zod";

export const initializePaymentSchema = z.object({
  amount: z.number().int().min(100, "Minimum amount is ₦100").max(500000, "Maximum amount is ₦500,000"),
});

export const verifyPaymentSchema = z.object({
  reference: z.string().min(1, "Reference is required"),
});

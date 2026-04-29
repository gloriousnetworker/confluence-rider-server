import { z } from "zod";

export const topupSchema = z.object({
  amount: z.number().int().positive("Amount must be positive"),
  paymentMethod: z.enum(["card", "bank_transfer", "ussd"]),
});

export const transactionsQuerySchema = z.object({
  type: z.enum(["debit", "credit"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TopupInput = z.infer<typeof topupSchema>;

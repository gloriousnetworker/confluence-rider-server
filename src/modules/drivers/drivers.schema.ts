import { z } from "zod";

export const withdrawSchema = z.object({
  amount: z.number().int().min(500, "Minimum withdrawal is ₦500"),
  bankCode: z.string().min(1, "Bank code is required"),
  accountNumber: z.string().length(10, "Account number must be 10 digits"),
  accountName: z.string().min(1, "Account name is required"),
});

export const earningsQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "all"]).default("month"),
});

export type WithdrawInput = z.infer<typeof withdrawSchema>;

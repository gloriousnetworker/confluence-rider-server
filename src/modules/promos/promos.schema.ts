import { z } from "zod";

export const validatePromoSchema = z.object({
  code: z.string().min(1).max(50),
});

import { z } from "zod";

export const tripsQuerySchema = z.object({
  status: z.enum(["completed", "cancelled"]).optional(),
  type: z.enum(["bike", "keke", "cab", "shared", "intercity", "campus"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const tripParamsSchema = z.object({
  id: z.string().uuid(),
});

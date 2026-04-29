import { z } from "zod";

export const notificationsQuerySchema = z.object({
  type: z.enum(["promo", "safety", "trip", "rating"]).optional(),
  unread: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const notificationParamsSchema = z.object({
  id: z.string().uuid(),
});

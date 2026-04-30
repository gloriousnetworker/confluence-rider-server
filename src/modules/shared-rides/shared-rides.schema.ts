import { z } from "zod";

export const createSharedRideSchema = z.object({
  pickup: z.string().min(1).max(255),
  destination: z.string().min(1).max(255),
});

export const sharedRideParamsSchema = z.object({
  id: z.string().uuid(),
});

export const availableRidesQuerySchema = z.object({
  pickup: z.string().optional(),
  destination: z.string().optional(),
});

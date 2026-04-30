import { z } from "zod";

export const shuttleRoutesQuery = z.object({
  origin: z.string().optional(),
  destination: z.string().optional(),
});

export const shuttleScheduleQuery = z.object({
  routeId: z.string().uuid().optional(),
  day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).optional(),
});

export const bookShuttleSchema = z.object({
  scheduleId: z.string().uuid(),
  travelDate: z.string().min(10), // "2026-05-01"
  seatCount: z.number().int().min(1).max(5).default(1),
  isStudent: z.boolean().default(false),
});

export const shuttleParamsSchema = z.object({
  id: z.string().uuid(),
});

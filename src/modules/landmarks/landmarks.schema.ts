import { z } from "zod";

export const getLandmarksQuery = z.object({
  area: z.string().optional(),
  popular: z.coerce.boolean().optional(),
});

export const searchLandmarksQuery = z.object({
  q: z.string().min(1, "Search query is required"),
});

import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  language: z.enum(["english", "ebira", "igala", "yoruba"]).optional(),
  avatarUrl: z.string().url().max(500).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD").optional(),
});

export const createSavedPlaceSchema = z.object({
  label: z.enum(["home", "work", "campus", "other"]),
  customLabel: z.string().max(100).optional(),
  address: z.string().min(1).max(255),
  landmarkId: z.string().uuid().optional(),
});

export const savedPlaceParamsSchema = z.object({
  id: z.string().uuid(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateSavedPlaceInput = z.infer<typeof createSavedPlaceSchema>;

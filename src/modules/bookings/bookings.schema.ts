import { z } from "zod";

export const createBookingSchema = z.object({
  rideType: z.enum(["bike", "keke", "cab", "shared", "intercity", "campus"]),
  pickup: z.string().min(1, "Pickup location is required").max(255),
  destination: z.string().min(1, "Destination is required").max(255),
  distanceKm: z.number().positive().optional(), // from frontend map calculation
  riderOffer: z.number().int().positive().optional(), // rider's manual price offer
});

export const bookingParamsSchema = z.object({
  id: z.string().uuid(),
});

export const calculateFareSchema = z.object({
  negotiatedFare: z.number().int().positive("Fare must be positive"),
});

export const acceptDriverSchema = z.object({
  driverId: z.string().uuid(),
  agreedFare: z.number().int().positive("Fare must be positive"),
});

export const updateStatusSchema = z.object({
  status: z.enum(["arriving", "ontrip"]),
});

export const rateBookingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AcceptDriverInput = z.infer<typeof acceptDriverSchema>;
export type RateBookingInput = z.infer<typeof rateBookingSchema>;

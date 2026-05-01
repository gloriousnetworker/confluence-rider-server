import { z } from "zod";

export const createDeliverySchema = z.object({
  type: z.enum(["food", "courier", "package", "grocery"]),
  size: z.enum(["small", "medium", "large"]).default("small"),
  pickupAddress: z.string().min(1).max(255),
  pickupContact: z.string().max(100).optional(),
  pickupPhone: z.string().max(15).optional(),
  dropoffAddress: z.string().min(1).max(255),
  recipientName: z.string().min(1).max(100),
  recipientPhone: z.string().min(10).max(15),
  itemDescription: z.string().min(1).max(500),
  specialInstructions: z.string().max(1000).optional(),
  isFragile: z.boolean().default(false),
  requiresSignature: z.boolean().default(false),
});

export const deliveryParamsSchema = z.object({
  id: z.string().uuid(),
});

export const deliveryQuerySchema = z.object({
  status: z.enum(["pending", "confirmed", "finding_rider", "picked_up", "in_transit", "delivered", "cancelled"]).optional(),
  type: z.enum(["food", "courier", "package", "grocery"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(["confirmed", "finding_rider", "picked_up", "in_transit", "delivered", "cancelled"]),
});

export const rateDeliverySchema = z.object({
  rating: z.number().int().min(1).max(5),
});

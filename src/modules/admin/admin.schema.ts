import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const usersQuery = paginationQuery.extend({
  role: z.enum(["rider", "driver", "admin"]).optional(),
  search: z.string().optional(),
});

export const driversQuery = paginationQuery.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const ridesQuery = paginationQuery.extend({
  status: z.enum(["finding", "negotiating", "accepted", "arriving", "ontrip", "completed", "cancelled"]).optional(),
});

export const driverParamsSchema = z.object({
  id: z.string().uuid(),
});

export const approveDriverSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

// Promo CRUD
export const createPromoSchema = z.object({
  code: z.string().min(3).max(50).transform((v) => v.toUpperCase()),
  discountPercent: z.number().int().min(1).max(100),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  usageLimit: z.number().int().min(1).optional(),
});

export const updatePromoSchema = z.object({
  discountPercent: z.number().int().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().min(10)).optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
});

export const promoParamsSchema = z.object({
  id: z.string().uuid(),
});

// User ban/suspend
export const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export const userActionSchema = z.object({
  action: z.enum(["suspend", "unsuspend", "ban", "unban"]),
});

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

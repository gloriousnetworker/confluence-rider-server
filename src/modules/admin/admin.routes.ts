import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  usersQuery, driversQuery, ridesQuery, driverParamsSchema, approveDriverSchema,
  createPromoSchema, updatePromoSchema, promoParamsSchema,
  userParamsSchema, userActionSchema,
} from "./admin.schema.js";
import * as adminService from "./admin.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/require-role.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);
  typedApp.addHook("preHandler", requireRole("admin"));

  // ─── Users ───
  typedApp.get("/users", {
    schema: { querystring: usersQuery, tags: ["Admin"], summary: "List all users" },
  }, async (request) => {
    const { users, meta } = await adminService.listUsers(request.query);
    return successResponse(users, meta);
  });

  // PATCH /api/admin/users/:id/action — suspend/ban/unsuspend/unban
  typedApp.patch("/users/:id/action", {
    schema: { params: userParamsSchema, body: userActionSchema, tags: ["Admin"], summary: "Suspend or ban a user" },
  }, async (request) => {
    const data = await adminService.userAction(request.params.id, request.body.action);
    return successResponse(data);
  });

  // ─── Drivers ───
  typedApp.get("/drivers", {
    schema: { querystring: driversQuery, tags: ["Admin"], summary: "List all drivers" },
  }, async (request) => {
    const { drivers, meta } = await adminService.listDrivers(request.query);
    return successResponse(drivers, meta);
  });

  typedApp.patch("/drivers/:id/approve", {
    schema: { params: driverParamsSchema, body: approveDriverSchema, tags: ["Admin"], summary: "Approve/reject driver" },
  }, async (request) => {
    const data = await adminService.approveDriver(request.params.id, request.body.status);
    return successResponse(data);
  });

  // ─── Rides ───
  typedApp.get("/rides", {
    schema: { querystring: ridesQuery, tags: ["Admin"], summary: "List all rides" },
  }, async (request) => {
    const { rides, meta } = await adminService.listRides(request.query);
    return successResponse(rides, meta);
  });

  // ─── Analytics ───
  typedApp.get("/analytics", {
    schema: { tags: ["Admin"], summary: "Get platform analytics" },
  }, async () => {
    const data = await adminService.getAnalytics();
    return successResponse(data);
  });

  // ─── Promos CRUD ───
  typedApp.get("/promos", {
    schema: { tags: ["Admin"], summary: "List all promo codes" },
  }, async () => {
    const data = await adminService.listPromos();
    return successResponse(data);
  });

  typedApp.post("/promos", {
    schema: { body: createPromoSchema, tags: ["Admin"], summary: "Create promo code" },
  }, async (request, reply) => {
    const data = await adminService.createPromo(request.body);
    return reply.status(201).send(successResponse(data));
  });

  typedApp.put("/promos/:id", {
    schema: { params: promoParamsSchema, body: updatePromoSchema, tags: ["Admin"], summary: "Update promo code" },
  }, async (request) => {
    const data = await adminService.updatePromo(request.params.id, request.body);
    return successResponse(data);
  });

  typedApp.delete("/promos/:id", {
    schema: { params: promoParamsSchema, tags: ["Admin"], summary: "Delete promo code" },
  }, async (request) => {
    const data = await adminService.deletePromo(request.params.id);
    return successResponse(data);
  });
};

import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { usersQuery, driversQuery, ridesQuery, driverParamsSchema, approveDriverSchema } from "./admin.schema.js";
import * as adminService from "./admin.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/require-role.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // All admin routes require auth + admin role
  typedApp.addHook("preHandler", authenticate);
  typedApp.addHook("preHandler", requireRole("admin"));

  // GET /api/admin/users
  typedApp.get(
    "/users",
    {
      schema: { querystring: usersQuery, tags: ["Admin"], summary: "List all users" },
    },
    async (request) => {
      const { users, meta } = await adminService.listUsers(request.query);
      return successResponse(users, meta);
    }
  );

  // GET /api/admin/drivers
  typedApp.get(
    "/drivers",
    {
      schema: { querystring: driversQuery, tags: ["Admin"], summary: "List all drivers with KYC status" },
    },
    async (request) => {
      const { drivers, meta } = await adminService.listDrivers(request.query);
      return successResponse(drivers, meta);
    }
  );

  // PATCH /api/admin/drivers/:id/approve
  typedApp.patch(
    "/drivers/:id/approve",
    {
      schema: {
        params: driverParamsSchema,
        body: approveDriverSchema,
        tags: ["Admin"],
        summary: "Approve or reject driver KYC",
      },
    },
    async (request) => {
      const data = await adminService.approveDriver(request.params.id, request.body.status);
      return successResponse(data);
    }
  );

  // GET /api/admin/rides
  typedApp.get(
    "/rides",
    {
      schema: { querystring: ridesQuery, tags: ["Admin"], summary: "List all rides" },
    },
    async (request) => {
      const { rides, meta } = await adminService.listRides(request.query);
      return successResponse(rides, meta);
    }
  );

  // GET /api/admin/analytics
  typedApp.get(
    "/analytics",
    {
      schema: { tags: ["Admin"], summary: "Get platform analytics/KPIs" },
    },
    async () => {
      const data = await adminService.getAnalytics();
      return successResponse(data);
    }
  );
};

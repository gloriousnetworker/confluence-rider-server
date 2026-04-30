import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { shuttleRoutesQuery, shuttleScheduleQuery, bookShuttleSchema, shuttleParamsSchema } from "./shuttles.schema.js";
import * as shuttleService from "./shuttles.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const shuttleRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/shuttles/routes — public
  typedApp.get("/routes", {
    schema: { querystring: shuttleRoutesQuery, tags: ["Campus Shuttles"], summary: "List shuttle routes" },
  }, async (request) => {
    const data = await shuttleService.getRoutes(request.query);
    return successResponse(data);
  });

  // GET /api/shuttles/schedules — public
  typedApp.get("/schedules", {
    schema: { querystring: shuttleScheduleQuery, tags: ["Campus Shuttles"], summary: "List shuttle schedules" },
  }, async (request) => {
    const data = await shuttleService.getSchedules(request.query);
    return successResponse(data);
  });

  // Below routes require auth
  typedApp.register(async (authApp) => {
    authApp.addHook("preHandler", authenticate);

    // POST /api/shuttles/book
    authApp.withTypeProvider<ZodTypeProvider>().post("/book", {
      schema: { body: bookShuttleSchema, tags: ["Campus Shuttles"], summary: "Book shuttle seat(s)" },
    }, async (request, reply) => {
      const data = await shuttleService.bookShuttle(request.user.sub, request.body);
      return reply.status(201).send(successResponse(data));
    });

    // GET /api/shuttles/my-bookings
    authApp.get("/my-bookings", {
      schema: { tags: ["Campus Shuttles"], summary: "Get my shuttle bookings" },
    }, async (request) => {
      const data = await shuttleService.getMyShuttleBookings(request.user.sub);
      return successResponse(data);
    });

    // POST /api/shuttles/bookings/:id/cancel
    authApp.withTypeProvider<ZodTypeProvider>().post("/bookings/:id/cancel", {
      schema: { params: shuttleParamsSchema, tags: ["Campus Shuttles"], summary: "Cancel shuttle booking" },
    }, async (request) => {
      const data = await shuttleService.cancelShuttleBooking(request.user.sub, request.params.id);
      return successResponse(data);
    });
  });
};

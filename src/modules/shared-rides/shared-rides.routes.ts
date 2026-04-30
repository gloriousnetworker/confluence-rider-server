import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { createSharedRideSchema, sharedRideParamsSchema, availableRidesQuerySchema } from "./shared-rides.schema.js";
import * as sharedService from "./shared-rides.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const sharedRidesRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/shared-rides — List available shared rides to join
  typedApp.get(
    "/",
    {
      schema: {
        querystring: availableRidesQuerySchema,
        tags: ["Shared Rides"],
        summary: "List available shared rides to join",
      },
    },
    async (request) => {
      const data = await sharedService.getAvailableSharedRides(request.query);
      return successResponse(data);
    }
  );

  // POST /api/shared-rides — Create or auto-join a shared ride
  typedApp.post(
    "/",
    {
      schema: {
        body: createSharedRideSchema,
        tags: ["Shared Rides"],
        summary: "Create a new shared ride pool (or join existing on same route)",
      },
    },
    async (request, reply) => {
      const data = await sharedService.createSharedRide(
        request.user.sub,
        request.body.pickup,
        request.body.destination
      );
      return reply.status(201).send(successResponse(data));
    }
  );

  // POST /api/shared-rides/:id/join — Join an existing shared ride
  typedApp.post(
    "/:id/join",
    {
      schema: {
        params: sharedRideParamsSchema,
        tags: ["Shared Rides"],
        summary: "Join an existing shared ride pool",
      },
    },
    async (request) => {
      const data = await sharedService.joinSharedRide(request.user.sub, request.params.id);
      return successResponse(data);
    }
  );

  // GET /api/shared-rides/:id — Get shared ride details with co-riders
  typedApp.get(
    "/:id",
    {
      schema: {
        params: sharedRideParamsSchema,
        tags: ["Shared Rides"],
        summary: "Get shared ride details and co-riders",
      },
    },
    async (request) => {
      const data = await sharedService.getSharedRideDetails(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );
};

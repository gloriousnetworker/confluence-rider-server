import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { tripsQuerySchema, tripParamsSchema } from "./trips.schema.js";
import * as tripsService from "./trips.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const tripsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/trips
  typedApp.get(
    "/",
    {
      schema: {
        querystring: tripsQuerySchema,
        tags: ["Trips"],
        summary: "Get trip history",
      },
    },
    async (request) => {
      const { trips, meta } = await tripsService.getTrips(request.user.sub, request.query);
      return successResponse(trips, meta);
    }
  );

  // GET /api/trips/:id/receipt
  typedApp.get(
    "/:id/receipt",
    {
      schema: {
        params: tripParamsSchema,
        tags: ["Trips"],
        summary: "Get trip receipt",
      },
    },
    async (request) => {
      const data = await tripsService.getReceipt(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );
};

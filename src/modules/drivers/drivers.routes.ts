import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { withdrawSchema, earningsQuerySchema } from "./drivers.schema.js";
import * as driversService from "./drivers.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const driversRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/drivers/earnings
  typedApp.get(
    "/earnings",
    {
      schema: {
        querystring: earningsQuerySchema,
        tags: ["Drivers"],
        summary: "Get driver earnings summary",
      },
    },
    async (request) => {
      const data = await driversService.getEarnings(request.user.sub, request.query.period);
      return successResponse(data);
    }
  );

  // POST /api/drivers/withdraw
  typedApp.post(
    "/withdraw",
    {
      schema: {
        body: withdrawSchema,
        tags: ["Drivers"],
        summary: "Withdraw earnings to bank account",
      },
    },
    async (request) => {
      const data = await driversService.withdrawEarnings(request.user.sub, request.body);
      return successResponse(data);
    }
  );

  // GET /api/drivers/banks
  typedApp.get(
    "/banks",
    {
      schema: {
        tags: ["Drivers"],
        summary: "Get list of Nigerian banks",
      },
    },
    async () => {
      const data = await driversService.getBanks();
      return successResponse(data);
    }
  );
};

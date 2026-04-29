import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { validatePromoSchema } from "./promos.schema.js";
import * as promosService from "./promos.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const promosRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // POST /api/promos/validate
  typedApp.post(
    "/validate",
    {
      schema: {
        body: validatePromoSchema,
        tags: ["Promos"],
        summary: "Validate a promo code",
      },
    },
    async (request) => {
      const data = await promosService.validatePromo(request.user.sub, request.body.code);
      return successResponse(data);
    }
  );
};

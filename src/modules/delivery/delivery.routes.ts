import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { createDeliverySchema, deliveryParamsSchema, deliveryQuerySchema, updateDeliveryStatusSchema, rateDeliverySchema } from "./delivery.schema.js";
import * as deliveryService from "./delivery.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const deliveryRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  typedApp.addHook("preHandler", authenticate);

  // POST /api/delivery — Create delivery order
  typedApp.post("/", {
    schema: { body: createDeliverySchema, tags: ["Delivery"], summary: "Create a delivery order" },
  }, async (request, reply) => {
    const data = await deliveryService.createDeliveryOrder(request.user.sub, request.body);
    return reply.status(201).send(successResponse(data));
  });

  // GET /api/delivery — My delivery orders
  typedApp.get("/", {
    schema: { querystring: deliveryQuerySchema, tags: ["Delivery"], summary: "List my delivery orders" },
  }, async (request) => {
    const { orders, meta } = await deliveryService.getMyDeliveries(request.user.sub, request.query);
    return successResponse(orders, meta);
  });

  // GET /api/delivery/:id — Order details
  typedApp.get("/:id", {
    schema: { params: deliveryParamsSchema, tags: ["Delivery"], summary: "Get delivery order details" },
  }, async (request) => {
    const data = await deliveryService.getDeliveryOrder(request.params.id, request.user.sub);
    return successResponse(data);
  });

  // PATCH /api/delivery/:id/status — Update delivery status
  typedApp.patch("/:id/status", {
    schema: { params: deliveryParamsSchema, body: updateDeliveryStatusSchema, tags: ["Delivery"], summary: "Update delivery status" },
  }, async (request) => {
    const data = await deliveryService.updateDeliveryStatus(request.params.id, request.user.sub, request.body.status);
    return successResponse(data);
  });

  // POST /api/delivery/:id/rate — Rate delivery
  typedApp.post("/:id/rate", {
    schema: { params: deliveryParamsSchema, body: rateDeliverySchema, tags: ["Delivery"], summary: "Rate completed delivery" },
  }, async (request) => {
    const data = await deliveryService.rateDelivery(request.params.id, request.user.sub, request.body.rating);
    return successResponse(data);
  });
};

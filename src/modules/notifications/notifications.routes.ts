import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { notificationsQuerySchema, notificationParamsSchema } from "./notifications.schema.js";
import * as notifService from "./notifications.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/notifications
  typedApp.get(
    "/",
    {
      schema: {
        querystring: notificationsQuerySchema,
        tags: ["Notifications"],
        summary: "Get notifications",
      },
    },
    async (request) => {
      const { notifications, meta } = await notifService.getNotifications(
        request.user.sub,
        request.query
      );
      return successResponse(notifications, meta);
    }
  );

  // PATCH /api/notifications/:id/read
  typedApp.patch(
    "/:id/read",
    {
      schema: {
        params: notificationParamsSchema,
        tags: ["Notifications"],
        summary: "Mark notification as read",
      },
    },
    async (request) => {
      const data = await notifService.markAsRead(request.params.id, request.user.sub);
      return successResponse(data);
    }
  );

  // GET /api/notifications/unread-count
  typedApp.get(
    "/unread-count",
    {
      schema: { tags: ["Notifications"], summary: "Get unread notification count" },
    },
    async (request) => {
      const data = await notifService.getUnreadCount(request.user.sub);
      return successResponse(data);
    }
  );
};

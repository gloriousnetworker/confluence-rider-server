import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { successResponse } from "../../utils/api-response.js";

const registerTokenSchema = z.object({
  token: z.string().min(1, "FCM token is required"),
});

export const pushRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // POST /api/push/register — Register or update FCM token
  typedApp.post(
    "/register",
    {
      schema: {
        body: registerTokenSchema,
        tags: ["Push Notifications"],
        summary: "Register FCM token for push notifications",
      },
    },
    async (request, reply) => {
      const userId = request.user.sub;
      const { token } = request.body;

      // Check if token already exists for this user
      const [existing] = await db
        .select()
        .from(schema.fcmTokens)
        .where(
          and(
            eq(schema.fcmTokens.userId, userId),
            eq(schema.fcmTokens.token, token)
          )
        )
        .limit(1);

      if (existing) {
        // Update timestamp
        await db
          .update(schema.fcmTokens)
          .set({ updatedAt: new Date() })
          .where(eq(schema.fcmTokens.id, existing.id));

        return successResponse({ message: "Token already registered" });
      }

      // Insert new token
      await db.insert(schema.fcmTokens).values({ userId, token });

      return reply.status(201).send(successResponse({ message: "Push notifications enabled" }));
    }
  );

  // DELETE /api/push/unregister — Remove FCM token
  typedApp.post(
    "/unregister",
    {
      schema: {
        body: registerTokenSchema,
        tags: ["Push Notifications"],
        summary: "Unregister FCM token",
      },
    },
    async (request) => {
      const userId = request.user.sub;
      const { token } = request.body;

      await db
        .delete(schema.fcmTokens)
        .where(
          and(
            eq(schema.fcmTokens.userId, userId),
            eq(schema.fcmTokens.token, token)
          )
        );

      return successResponse({ message: "Push notifications disabled" });
    }
  );
};

/**
 * Helper: get all FCM tokens for a user.
 */
export async function getUserFcmTokens(userId: string): Promise<string[]> {
  const tokens = await db
    .select({ token: schema.fcmTokens.token })
    .from(schema.fcmTokens)
    .where(eq(schema.fcmTokens.userId, userId));

  return tokens.map((t) => t.token);
}

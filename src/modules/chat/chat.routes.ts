import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { authenticate } from "../../middleware/authenticate.js";
import { successResponse } from "../../utils/api-response.js";
import { getIO } from "../../services/socket.js";

const sendMessageSchema = z.object({
  bookingId: z.string().uuid(),
  message: z.string().min(1).max(1000),
});

const chatParamsSchema = z.object({
  bookingId: z.string().uuid(),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  typedApp.addHook("preHandler", authenticate);

  // POST /api/chat/send
  typedApp.post("/send", {
    schema: { body: sendMessageSchema, tags: ["Chat"], summary: "Send a chat message" },
  }, async (request, reply) => {
    const { bookingId, message } = request.body;
    const senderId = request.user.sub;

    const [msg] = await db.insert(schema.chatMessages).values({
      bookingId, senderId, message,
    }).returning();

    // Emit via Socket.IO to the booking room
    getIO()?.to(`booking:${bookingId}`).emit("chat-message", {
      id: msg.id,
      bookingId,
      senderId,
      senderName: request.user.name,
      message,
      createdAt: msg.createdAt,
    });

    return reply.status(201).send(successResponse(msg));
  });

  // GET /api/chat/:bookingId
  typedApp.get("/:bookingId", {
    schema: { params: chatParamsSchema, tags: ["Chat"], summary: "Get chat messages for a booking" },
  }, async (request) => {
    const messages = await db
      .select({
        id: schema.chatMessages.id,
        senderId: schema.chatMessages.senderId,
        senderName: schema.users.name,
        message: schema.chatMessages.message,
        isRead: schema.chatMessages.isRead,
        createdAt: schema.chatMessages.createdAt,
      })
      .from(schema.chatMessages)
      .innerJoin(schema.users, eq(schema.chatMessages.senderId, schema.users.id))
      .where(eq(schema.chatMessages.bookingId, request.params.bookingId))
      .orderBy(schema.chatMessages.createdAt)
      .limit(100);

    return successResponse(messages);
  });

  // PATCH /api/chat/:bookingId/read — mark all as read
  typedApp.patch("/:bookingId/read", {
    schema: { params: chatParamsSchema, tags: ["Chat"], summary: "Mark messages as read" },
  }, async (request) => {
    await db.update(schema.chatMessages)
      .set({ isRead: true })
      .where(and(
        eq(schema.chatMessages.bookingId, request.params.bookingId),
        eq(schema.chatMessages.isRead, false)
      ));
    return successResponse({ message: "Messages marked as read" });
  });
};

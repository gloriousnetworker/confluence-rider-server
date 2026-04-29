import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  updateProfileSchema,
  createSavedPlaceSchema,
  savedPlaceParamsSchema,
} from "./users.schema.js";
import * as usersService from "./users.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // All routes require auth
  typedApp.addHook("preHandler", authenticate);

  // GET /api/users/me
  typedApp.get(
    "/me",
    {
      schema: { tags: ["Users"], summary: "Get current user profile" },
    },
    async (request) => {
      const data = await usersService.getProfile(request.user.sub);
      return successResponse(data);
    }
  );

  // PUT /api/users/me
  typedApp.put(
    "/me",
    {
      schema: {
        body: updateProfileSchema,
        tags: ["Users"],
        summary: "Update current user profile",
      },
    },
    async (request) => {
      const data = await usersService.updateProfile(request.user.sub, request.body);
      return successResponse(data);
    }
  );

  // GET /api/users/me/stats
  typedApp.get(
    "/me/stats",
    {
      schema: { tags: ["Users"], summary: "Get user stats (trips, rating, referrals)" },
    },
    async (request) => {
      const data = await usersService.getStats(request.user.sub);
      return successResponse(data);
    }
  );

  // GET /api/users/me/saved-places
  typedApp.get(
    "/me/saved-places",
    {
      schema: { tags: ["Users"], summary: "Get saved places" },
    },
    async (request) => {
      const data = await usersService.getSavedPlaces(request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/users/me/saved-places
  typedApp.post(
    "/me/saved-places",
    {
      schema: {
        body: createSavedPlaceSchema,
        tags: ["Users"],
        summary: "Create a saved place",
      },
    },
    async (request, reply) => {
      const data = await usersService.createSavedPlace(request.user.sub, request.body);
      return reply.status(201).send(successResponse(data));
    }
  );

  // DELETE /api/users/me/saved-places/:id
  typedApp.delete(
    "/me/saved-places/:id",
    {
      schema: {
        params: savedPlaceParamsSchema,
        tags: ["Users"],
        summary: "Delete a saved place",
      },
    },
    async (request) => {
      const data = await usersService.deleteSavedPlace(request.user.sub, request.params.id);
      return successResponse(data);
    }
  );
};

import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { getLandmarksQuery, searchLandmarksQuery } from "./landmarks.schema.js";
import { getAllLandmarks, searchLandmarks } from "./landmarks.service.js";
import { successResponse } from "../../utils/api-response.js";

export const landmarkRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/",
    {
      schema: {
        querystring: getLandmarksQuery,
        tags: ["Landmarks"],
        summary: "Get all landmarks",
        description: "List landmarks with optional area and popularity filters",
      },
    },
    async (request) => {
      const { area, popular } = request.query;
      const data = await getAllLandmarks({ area, popular });
      return successResponse(data);
    }
  );

  typedApp.get(
    "/search",
    {
      schema: {
        querystring: searchLandmarksQuery,
        tags: ["Landmarks"],
        summary: "Search landmarks",
        description:
          "Case-insensitive search against landmark names and areas",
      },
    },
    async (request) => {
      const { q } = request.query;
      const data = await searchLandmarks(q);
      return successResponse(data);
    }
  );
};

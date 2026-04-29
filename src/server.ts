import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyJwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { landmarkRoutes } from "./modules/landmarks/landmarks.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export async function createApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV !== "test"
        ? {
            transport: {
              target: "pino-pretty",
              options: { colorize: true },
            },
          }
        : false,
  }).withTypeProvider<ZodTypeProvider>();

  // Set Zod validators
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Plugins
  await app.register(cors, { origin: env.CORS_ORIGIN });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Confluence Ride API",
        description: "Backend API for the Confluence Ride platform",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // API routes
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(landmarkRoutes, { prefix: "/landmarks" });
    },
    { prefix: "/api" }
  );

  return app;
}

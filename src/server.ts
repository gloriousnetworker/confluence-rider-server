import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyJwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
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
import { usersRoutes } from "./modules/users/users.routes.js";
import { bookingsRoutes } from "./modules/bookings/bookings.routes.js";
import { walletRoutes } from "./modules/wallet/wallet.routes.js";
import { tripsRoutes } from "./modules/trips/trips.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { promosRoutes } from "./modules/promos/promos.routes.js";
import { referralsRoutes } from "./modules/referrals/referrals.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { uploadRoutes } from "./modules/upload/upload.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { pushRoutes } from "./modules/notifications/push.routes.js";
import { driversRoutes } from "./modules/drivers/drivers.routes.js";
import { sharedRidesRoutes } from "./modules/shared-rides/shared-rides.routes.js";

export async function createApp() {
  const loggerConfig =
    env.NODE_ENV === "test"
      ? false
      : env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty", options: { colorize: true } } }
        : true; // production: plain JSON logs

  const app = Fastify({
    logger: loggerConfig,
  }).withTypeProvider<ZodTypeProvider>();

  // Set Zod validators
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Plugins
  await app.register(cors, { origin: env.CORS_ORIGIN });

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  });

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
      await api.register(usersRoutes, { prefix: "/users" });
      await api.register(bookingsRoutes, { prefix: "/bookings" });
      await api.register(walletRoutes, { prefix: "/wallet" });
      await api.register(tripsRoutes, { prefix: "/trips" });
      await api.register(notificationsRoutes, { prefix: "/notifications" });
      await api.register(landmarkRoutes, { prefix: "/landmarks" });
      await api.register(promosRoutes, { prefix: "/promos" });
      await api.register(referralsRoutes, { prefix: "/referrals" });
      await api.register(adminRoutes, { prefix: "/admin" });
      await api.register(uploadRoutes, { prefix: "/upload" });
      await api.register(paymentsRoutes, { prefix: "/payments" });
      await api.register(pushRoutes, { prefix: "/push" });
      await api.register(driversRoutes, { prefix: "/drivers" });
      await api.register(sharedRidesRoutes, { prefix: "/shared-rides" });
    },
    { prefix: "/api" }
  );

  return app;
}

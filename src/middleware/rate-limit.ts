import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

export async function authRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 10,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.ip;
    },
  });
}

export async function otpRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 5,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.ip;
    },
  });
}

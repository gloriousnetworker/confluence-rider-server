import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "./error-handler.js";

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }
  };
}

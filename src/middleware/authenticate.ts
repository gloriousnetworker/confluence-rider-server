import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "./error-handler.js";

export interface JwtPayload {
  sub: string;
  phone: string;
  name: string;
  role: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  }
}

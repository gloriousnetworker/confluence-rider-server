import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // App-level errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.flatten().fieldErrors,
      },
    });
  }

  // Cast to check Fastify-specific properties
  const fastifyErr = error as FastifyError;

  // Fastify validation errors
  if ("validation" in error && fastifyErr.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
        details: fastifyErr.validation,
      },
    });
  }

  // Rate limit errors
  if (fastifyErr.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    });
  }

  // JWT errors
  if (
    fastifyErr.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" ||
    fastifyErr.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
    fastifyErr.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID"
  ) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired authentication token",
      },
    });
  }

  // Unknown errors
  request.log.error(error);
  return reply.status(500).send({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./server.js";
import type { FastifyInstance } from "fastify";

describe("Server", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("returns status ok", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });
  });
});

import { describe, it, expect } from "vitest";
import { tripsQuerySchema, tripParamsSchema } from "./trips.schema.js";

describe("Trips Schemas", () => {
  describe("tripsQuerySchema", () => {
    it("applies defaults", () => {
      const result = tripsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("accepts status filter", () => {
      expect(tripsQuerySchema.parse({ status: "completed" }).status).toBe("completed");
      expect(tripsQuerySchema.parse({ status: "cancelled" }).status).toBe("cancelled");
    });

    it("accepts type filter", () => {
      for (const type of ["bike", "keke", "cab", "shared", "intercity", "campus"]) {
        expect(tripsQuerySchema.parse({ type }).type).toBe(type);
      }
    });

    it("rejects invalid status", () => {
      expect(() => tripsQuerySchema.parse({ status: "pending" })).toThrow();
    });
  });

  describe("tripParamsSchema", () => {
    it("accepts valid UUID", () => {
      expect(() => tripParamsSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
    });

    it("rejects non-UUID", () => {
      expect(() => tripParamsSchema.parse({ id: "not-a-uuid" })).toThrow();
    });
  });
});

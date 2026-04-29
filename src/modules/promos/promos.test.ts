import { describe, it, expect } from "vitest";
import { validatePromoSchema } from "./promos.schema.js";

describe("Promos Schemas", () => {
  describe("validatePromoSchema", () => {
    it("accepts valid code", () => {
      expect(validatePromoSchema.parse({ code: "CONFLUENCE50" }).code).toBe("CONFLUENCE50");
    });

    it("rejects empty code", () => {
      expect(() => validatePromoSchema.parse({ code: "" })).toThrow();
    });
  });
});

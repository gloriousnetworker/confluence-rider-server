import { describe, it, expect } from "vitest";
import { updateProfileSchema, createSavedPlaceSchema, savedPlaceParamsSchema } from "./users.schema.js";

describe("Users Schemas", () => {
  describe("updateProfileSchema", () => {
    it("accepts valid update", () => {
      const result = updateProfileSchema.parse({ name: "New Name", language: "igala" });
      expect(result.name).toBe("New Name");
      expect(result.language).toBe("igala");
    });

    it("accepts empty body (no changes)", () => {
      expect(() => updateProfileSchema.parse({})).not.toThrow();
    });

    it("accepts all languages", () => {
      for (const lang of ["english", "ebira", "igala", "yoruba"]) {
        expect(updateProfileSchema.parse({ language: lang }).language).toBe(lang);
      }
    });

    it("rejects invalid language", () => {
      expect(() => updateProfileSchema.parse({ language: "french" })).toThrow();
    });

    it("rejects invalid email", () => {
      expect(() => updateProfileSchema.parse({ email: "not-email" })).toThrow();
    });

    it("accepts valid email", () => {
      expect(updateProfileSchema.parse({ email: "test@example.com" }).email).toBe("test@example.com");
    });
  });

  describe("createSavedPlaceSchema", () => {
    it("accepts valid saved place", () => {
      const result = createSavedPlaceSchema.parse({ label: "home", address: "Ganaja Junction" });
      expect(result.label).toBe("home");
    });

    it("accepts all labels", () => {
      for (const label of ["home", "work", "campus", "other"]) {
        expect(() => createSavedPlaceSchema.parse({ label, address: "Test" })).not.toThrow();
      }
    });

    it("rejects invalid label", () => {
      expect(() => createSavedPlaceSchema.parse({ label: "gym", address: "Test" })).toThrow();
    });

    it("rejects empty address", () => {
      expect(() => createSavedPlaceSchema.parse({ label: "home", address: "" })).toThrow();
    });

    it("accepts optional customLabel", () => {
      const result = createSavedPlaceSchema.parse({ label: "other", address: "Test", customLabel: "Gym" });
      expect(result.customLabel).toBe("Gym");
    });
  });

  describe("savedPlaceParamsSchema", () => {
    it("accepts valid UUID", () => {
      expect(() => savedPlaceParamsSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
    });

    it("rejects non-UUID", () => {
      expect(() => savedPlaceParamsSchema.parse({ id: "abc" })).toThrow();
    });
  });
});

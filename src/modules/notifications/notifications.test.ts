import { describe, it, expect } from "vitest";
import { notificationsQuerySchema, notificationParamsSchema } from "./notifications.schema.js";

describe("Notifications Schemas", () => {
  describe("notificationsQuerySchema", () => {
    it("applies defaults", () => {
      const result = notificationsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("accepts type filter", () => {
      for (const type of ["promo", "safety", "trip", "rating"]) {
        expect(notificationsQuerySchema.parse({ type }).type).toBe(type);
      }
    });

    it("accepts unread filter", () => {
      expect(notificationsQuerySchema.parse({ unread: true }).unread).toBe(true);
      expect(notificationsQuerySchema.parse({ unread: false }).unread).toBe(false);
    });

    it("rejects invalid type", () => {
      expect(() => notificationsQuerySchema.parse({ type: "email" })).toThrow();
    });
  });

  describe("notificationParamsSchema", () => {
    it("accepts valid UUID", () => {
      expect(() => notificationParamsSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
    });

    it("rejects non-UUID", () => {
      expect(() => notificationParamsSchema.parse({ id: "abc" })).toThrow();
    });
  });
});

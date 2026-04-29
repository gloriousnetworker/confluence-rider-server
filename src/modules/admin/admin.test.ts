import { describe, it, expect } from "vitest";
import { usersQuery, driversQuery, ridesQuery, approveDriverSchema, driverParamsSchema } from "./admin.schema.js";

describe("Admin Schemas", () => {
  describe("usersQuery", () => {
    it("applies defaults", () => {
      const result = usersQuery.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("accepts role filter", () => {
      expect(usersQuery.parse({ role: "rider" }).role).toBe("rider");
      expect(usersQuery.parse({ role: "driver" }).role).toBe("driver");
      expect(usersQuery.parse({ role: "admin" }).role).toBe("admin");
    });

    it("accepts search", () => {
      expect(usersQuery.parse({ search: "Adamu" }).search).toBe("Adamu");
    });

    it("rejects invalid role", () => {
      expect(() => usersQuery.parse({ role: "superadmin" })).toThrow();
    });
  });

  describe("driversQuery", () => {
    it("accepts status filter", () => {
      expect(driversQuery.parse({ status: "pending" }).status).toBe("pending");
      expect(driversQuery.parse({ status: "approved" }).status).toBe("approved");
      expect(driversQuery.parse({ status: "rejected" }).status).toBe("rejected");
    });
  });

  describe("ridesQuery", () => {
    it("accepts all booking statuses", () => {
      for (const s of ["finding", "negotiating", "accepted", "arriving", "ontrip", "completed", "cancelled"]) {
        expect(ridesQuery.parse({ status: s }).status).toBe(s);
      }
    });
  });

  describe("approveDriverSchema", () => {
    it("accepts approved", () => {
      expect(approveDriverSchema.parse({ status: "approved" }).status).toBe("approved");
    });

    it("accepts rejected", () => {
      expect(approveDriverSchema.parse({ status: "rejected" }).status).toBe("rejected");
    });

    it("rejects pending", () => {
      expect(() => approveDriverSchema.parse({ status: "pending" })).toThrow();
    });
  });

  describe("driverParamsSchema", () => {
    it("accepts valid UUID", () => {
      expect(() => driverParamsSchema.parse({ id: "550e8400-e29b-41d4-a716-446655440000" })).not.toThrow();
    });

    it("rejects non-UUID", () => {
      expect(() => driverParamsSchema.parse({ id: "123" })).toThrow();
    });
  });
});

import { describe, it, expect } from "vitest";
import { createBookingSchema, calculateFareSchema, acceptDriverSchema, rateBookingSchema, cancelBookingSchema, updateStatusSchema } from "./bookings.schema.js";

describe("Bookings Schemas", () => {
  describe("createBookingSchema", () => {
    it("accepts valid booking", () => {
      const result = createBookingSchema.parse({
        rideType: "keke",
        pickup: "Ganaja Junction",
        destination: "Nataco Junction",
      });
      expect(result.rideType).toBe("keke");
    });

    it("accepts all ride types", () => {
      for (const type of ["bike", "keke", "cab", "shared", "intercity", "campus"]) {
        expect(() => createBookingSchema.parse({ rideType: type, pickup: "A", destination: "B" })).not.toThrow();
      }
    });

    it("rejects invalid ride type", () => {
      expect(() => createBookingSchema.parse({ rideType: "helicopter", pickup: "A", destination: "B" })).toThrow();
    });

    it("rejects empty pickup", () => {
      expect(() => createBookingSchema.parse({ rideType: "cab", pickup: "", destination: "B" })).toThrow();
    });

    it("rejects empty destination", () => {
      expect(() => createBookingSchema.parse({ rideType: "cab", pickup: "A", destination: "" })).toThrow();
    });
  });

  describe("calculateFareSchema", () => {
    it("accepts positive fare", () => {
      expect(calculateFareSchema.parse({ negotiatedFare: 500 }).negotiatedFare).toBe(500);
    });

    it("rejects zero fare", () => {
      expect(() => calculateFareSchema.parse({ negotiatedFare: 0 })).toThrow();
    });

    it("rejects negative fare", () => {
      expect(() => calculateFareSchema.parse({ negotiatedFare: -100 })).toThrow();
    });
  });

  describe("acceptDriverSchema", () => {
    it("accepts valid driver acceptance", () => {
      const result = acceptDriverSchema.parse({
        driverId: "550e8400-e29b-41d4-a716-446655440000",
        agreedFare: 450,
      });
      expect(result.agreedFare).toBe(450);
    });

    it("rejects non-uuid driverId", () => {
      expect(() => acceptDriverSchema.parse({ driverId: "not-uuid", agreedFare: 450 })).toThrow();
    });
  });

  describe("rateBookingSchema", () => {
    it("accepts ratings 1-5", () => {
      for (let i = 1; i <= 5; i++) {
        expect(rateBookingSchema.parse({ rating: i }).rating).toBe(i);
      }
    });

    it("rejects rating 0", () => {
      expect(() => rateBookingSchema.parse({ rating: 0 })).toThrow();
    });

    it("rejects rating 6", () => {
      expect(() => rateBookingSchema.parse({ rating: 6 })).toThrow();
    });

    it("accepts optional comment", () => {
      const result = rateBookingSchema.parse({ rating: 5, comment: "Great ride!" });
      expect(result.comment).toBe("Great ride!");
    });
  });

  describe("cancelBookingSchema", () => {
    it("accepts empty body", () => {
      expect(() => cancelBookingSchema.parse({})).not.toThrow();
    });

    it("accepts optional reason", () => {
      const result = cancelBookingSchema.parse({ reason: "Changed my mind" });
      expect(result.reason).toBe("Changed my mind");
    });
  });

  describe("updateStatusSchema", () => {
    it("accepts arriving", () => {
      expect(updateStatusSchema.parse({ status: "arriving" }).status).toBe("arriving");
    });

    it("accepts ontrip", () => {
      expect(updateStatusSchema.parse({ status: "ontrip" }).status).toBe("ontrip");
    });

    it("rejects completed (must use complete endpoint)", () => {
      expect(() => updateStatusSchema.parse({ status: "completed" })).toThrow();
    });

    it("rejects finding", () => {
      expect(() => updateStatusSchema.parse({ status: "finding" })).toThrow();
    });
  });
});

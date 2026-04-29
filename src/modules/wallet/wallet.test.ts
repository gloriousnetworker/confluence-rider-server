import { describe, it, expect } from "vitest";
import { topupSchema, transactionsQuerySchema } from "./wallet.schema.js";

describe("Wallet Schemas", () => {
  describe("topupSchema", () => {
    it("accepts valid topup", () => {
      const result = topupSchema.parse({ amount: 5000, paymentMethod: "card" });
      expect(result.amount).toBe(5000);
      expect(result.paymentMethod).toBe("card");
    });

    it("accepts all payment methods", () => {
      for (const method of ["card", "bank_transfer", "ussd"]) {
        expect(() => topupSchema.parse({ amount: 1000, paymentMethod: method })).not.toThrow();
      }
    });

    it("rejects zero amount", () => {
      expect(() => topupSchema.parse({ amount: 0, paymentMethod: "card" })).toThrow();
    });

    it("rejects negative amount", () => {
      expect(() => topupSchema.parse({ amount: -1000, paymentMethod: "card" })).toThrow();
    });

    it("rejects invalid payment method", () => {
      expect(() => topupSchema.parse({ amount: 1000, paymentMethod: "bitcoin" })).toThrow();
    });
  });

  describe("transactionsQuerySchema", () => {
    it("applies defaults", () => {
      const result = transactionsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("accepts type filter", () => {
      expect(transactionsQuerySchema.parse({ type: "credit" }).type).toBe("credit");
      expect(transactionsQuerySchema.parse({ type: "debit" }).type).toBe("debit");
    });

    it("rejects invalid type", () => {
      expect(() => transactionsQuerySchema.parse({ type: "refund" })).toThrow();
    });
  });
});

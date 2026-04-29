import { describe, it, expect } from "vitest";
import { shareReferralSchema } from "./referrals.schema.js";

describe("Referrals Schemas", () => {
  describe("shareReferralSchema", () => {
    it("accepts valid referral code", () => {
      expect(shareReferralSchema.parse({ referralCode: "ADAM-F07909" }).referralCode).toBe("ADAM-F07909");
    });

    it("rejects empty code", () => {
      expect(() => shareReferralSchema.parse({ referralCode: "" })).toThrow();
    });
  });
});

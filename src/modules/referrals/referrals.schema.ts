import { z } from "zod";

export const shareReferralSchema = z.object({
  referralCode: z.string().min(1),
});

import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { shareReferralSchema } from "./referrals.schema.js";
import * as referralsService from "./referrals.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const referralsRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/referrals/code
  typedApp.get(
    "/code",
    {
      schema: { tags: ["Referrals"], summary: "Get your referral code" },
    },
    async (request) => {
      const data = await referralsService.getReferralCode(request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/referrals/apply
  typedApp.post(
    "/apply",
    {
      schema: {
        body: shareReferralSchema,
        tags: ["Referrals"],
        summary: "Apply a referral code",
      },
    },
    async (request) => {
      const data = await referralsService.applyReferral(
        request.user.sub,
        request.body.referralCode
      );
      return successResponse(data);
    }
  );
};

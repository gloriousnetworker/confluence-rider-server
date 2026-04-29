import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { topupSchema, transactionsQuerySchema } from "./wallet.schema.js";
import * as walletService from "./wallet.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";

export const walletRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook("preHandler", authenticate);

  // GET /api/wallet
  typedApp.get(
    "/",
    { schema: { tags: ["Wallet"], summary: "Get wallet balance" } },
    async (request) => {
      const data = await walletService.getWallet(request.user.sub);
      return successResponse(data);
    }
  );

  // POST /api/wallet/topup
  typedApp.post(
    "/topup",
    {
      schema: {
        body: topupSchema,
        tags: ["Wallet"],
        summary: "Top up wallet",
      },
    },
    async (request) => {
      const data = await walletService.topup(request.user.sub, request.body);
      return successResponse(data);
    }
  );

  // GET /api/wallet/transactions
  typedApp.get(
    "/transactions",
    {
      schema: {
        querystring: transactionsQuerySchema,
        tags: ["Wallet"],
        summary: "Get transaction history",
      },
    },
    async (request) => {
      const { transactions, meta } = await walletService.getTransactions(
        request.user.sub,
        request.query
      );
      return successResponse(transactions, meta);
    }
  );

  // GET /api/wallet/savings
  typedApp.get(
    "/savings",
    { schema: { tags: ["Wallet"], summary: "Get monthly savings" } },
    async (request) => {
      const data = await walletService.getSavings(request.user.sub);
      return successResponse(data);
    }
  );
};

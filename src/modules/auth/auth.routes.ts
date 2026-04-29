import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  generateSecret,
  generateURI,
  verifySync,
  NobleCryptoPlugin,
  ScureBase32Plugin,
} from "otplib";

const totpPlugins = {
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
};
import QRCode from "qrcode";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import {
  registerSchema,
  verifyOtpSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  login2faSchema,
  verify2faSchema,
  disable2faSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";
import { successResponse } from "../../utils/api-response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { AppError } from "../../middleware/error-handler.js";

// Helper: sign JWT bypassing strict payload typing (service builds the payload dynamically)
function signJwt(app: { jwt: { sign: Function } }, payload: object, opts: object): string {
  return (app.jwt.sign as Function)(payload, opts);
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // POST /api/auth/register
  typedApp.post(
    "/register",
    {
      schema: {
        body: registerSchema,
        tags: ["Auth"],
        summary: "Register a new user",
      },
    },
    async (request, reply) => {
      const result = await authService.register(request.body);
      return reply.status(201).send(successResponse(result));
    }
  );

  // POST /api/auth/verify-otp
  typedApp.post(
    "/verify-otp",
    {
      schema: {
        body: verifyOtpSchema,
        tags: ["Auth"],
        summary: "Verify OTP and activate account",
      },
    },
    async (request) => {
      const result = await authService.verifyOtpAndActivate(
        request.body,
        (payload) => signJwt(app, payload, { expiresIn: "15m" })
      );
      return successResponse(result);
    }
  );

  // POST /api/auth/login
  typedApp.post(
    "/login",
    {
      schema: {
        body: loginSchema,
        tags: ["Auth"],
        summary: "Login with phone and password",
      },
    },
    async (request) => {
      const result = await authService.login(
        request.body,
        (payload) => signJwt(app, payload, { expiresIn: "15m" }),
        (payload) => signJwt(app, payload, { expiresIn: "5m" })
      );
      return successResponse(result);
    }
  );

  // POST /api/auth/login/2fa
  typedApp.post(
    "/login/2fa",
    {
      schema: {
        body: login2faSchema,
        tags: ["Auth"],
        summary: "Complete login with 2FA code",
      },
    },
    async (request) => {
      const { tempToken, code } = request.body;

      // Verify temp token
      let payload: { sub: string; scope: string };
      try {
        payload = app.jwt.verify<{ sub: string; scope: string }>(tempToken);
      } catch {
        throw new AppError(401, "UNAUTHORIZED", "Invalid or expired temporary token");
      }

      if (payload.scope !== "2fa-verify") {
        throw new AppError(401, "UNAUTHORIZED", "Invalid token scope");
      }

      // Get TOTP secret
      const totpRecord = await authService.getExistingTotpSecret(payload.sub);
      if (!totpRecord || !totpRecord.isVerified) {
        throw new AppError(400, "BAD_REQUEST", "2FA is not set up");
      }

      // Verify TOTP code
      const verifyResult = verifySync({ token: code, secret: totpRecord.secret, ...totpPlugins });
      if (!verifyResult.valid) {
        throw new AppError(422, "TOTP_INVALID", "Invalid 2FA code");
      }

      // Issue real token pair
      const result = await authService.issueTokenPair(
        payload.sub,
        (p) => signJwt(app, p, { expiresIn: "15m" })
      );

      return successResponse(result);
    }
  );

  // POST /api/auth/refresh-token
  typedApp.post(
    "/refresh-token",
    {
      schema: {
        body: refreshTokenSchema,
        tags: ["Auth"],
        summary: "Refresh access token",
      },
    },
    async (request) => {
      const result = await authService.refreshTokens(
        request.body,
        (payload) => signJwt(app, payload, { expiresIn: "15m" })
      );
      return successResponse(result);
    }
  );

  // POST /api/auth/logout
  typedApp.post(
    "/logout",
    {
      schema: {
        body: logoutSchema,
        tags: ["Auth"],
        summary: "Logout (revoke refresh token)",
      },
    },
    async (request) => {
      const result = await authService.logout(request.body);
      return successResponse(result);
    }
  );

  // POST /api/auth/forgot-password
  typedApp.post(
    "/forgot-password",
    {
      schema: {
        body: forgotPasswordSchema,
        tags: ["Auth"],
        summary: "Request password reset OTP",
      },
    },
    async (request) => {
      const result = await authService.forgotPassword(request.body);
      return successResponse(result);
    }
  );

  // POST /api/auth/reset-password
  typedApp.post(
    "/reset-password",
    {
      schema: {
        body: resetPasswordSchema,
        tags: ["Auth"],
        summary: "Reset password with OTP",
      },
    },
    async (request) => {
      const result = await authService.resetPassword(request.body);
      return successResponse(result);
    }
  );

  // --- 2FA Endpoints (require auth) ---

  // POST /api/auth/2fa/setup
  typedApp.post(
    "/2fa/setup",
    {
      schema: {
        tags: ["Auth - 2FA"],
        summary: "Set up 2FA (generates TOTP secret + QR code)",
      },
      preHandler: [authenticate],
    },
    async (request) => {
      const userId = request.user.sub;
      const user = await authService.get2faUser(userId);

      if (user.is2faEnabled) {
        throw new AppError(409, "CONFLICT", "2FA is already enabled");
      }

      // Clean up any existing unverified secret
      const existing = await authService.getExistingTotpSecret(userId);
      if (existing && !existing.isVerified) {
        await authService.deleteTotpSecret(userId);
      }

      const secret = generateSecret();
      const otpauthUrl = generateURI({
        issuer: "Confluence Ride",
        label: user.phone,
        secret,
      });
      const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

      await authService.saveTotpSecret(userId, secret);

      return successResponse({
        secret,
        otpauthUrl,
        qrCodeUrl,
      });
    }
  );

  // POST /api/auth/2fa/verify
  typedApp.post(
    "/2fa/verify",
    {
      schema: {
        body: verify2faSchema,
        tags: ["Auth - 2FA"],
        summary: "Verify 2FA setup with TOTP code",
      },
      preHandler: [authenticate],
    },
    async (request) => {
      const userId = request.user.sub;

      const totpRecord = await authService.getExistingTotpSecret(userId);
      if (!totpRecord) {
        throw new AppError(400, "BAD_REQUEST", "2FA setup not started. Call /2fa/setup first.");
      }
      if (totpRecord.isVerified) {
        throw new AppError(409, "CONFLICT", "2FA is already verified");
      }

      const verifyResult = verifySync({ token: request.body.code, secret: totpRecord.secret, ...totpPlugins });
      if (!verifyResult.valid) {
        throw new AppError(422, "TOTP_INVALID", "Invalid 2FA code");
      }

      // Generate backup codes
      const hashedBackupCodes: string[] = [];
      const plainBackupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        const code = nanoid(10);
        plainBackupCodes.push(code);
        hashedBackupCodes.push(await bcrypt.hash(code, 10));
      }

      await authService.verifyAndEnable2fa(userId, totpRecord, hashedBackupCodes);

      return successResponse({
        message: "2FA enabled successfully",
        backupCodes: plainBackupCodes,
      });
    }
  );

  // POST /api/auth/2fa/disable
  typedApp.post(
    "/2fa/disable",
    {
      schema: {
        body: disable2faSchema,
        tags: ["Auth - 2FA"],
        summary: "Disable 2FA (requires valid TOTP code)",
      },
      preHandler: [authenticate],
    },
    async (request) => {
      const userId = request.user.sub;

      const totpRecord = await authService.getExistingTotpSecret(userId);
      if (!totpRecord || !totpRecord.isVerified) {
        throw new AppError(400, "BAD_REQUEST", "2FA is not enabled");
      }

      const verifyResult = verifySync({ token: request.body.code, secret: totpRecord.secret, ...totpPlugins });
      if (!verifyResult.valid) {
        throw new AppError(422, "TOTP_INVALID", "Invalid 2FA code. Cannot disable.");
      }

      await authService.disable2fa(userId);

      return successResponse({ message: "2FA disabled successfully" });
    }
  );
};

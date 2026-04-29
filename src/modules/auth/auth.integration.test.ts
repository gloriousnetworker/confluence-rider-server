import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../server.js";
import type { FastifyInstance } from "fastify";

/**
 * Auth integration tests.
 * These require a running PostgreSQL database.
 * Set RUN_INTEGRATION=true to enable these tests.
 */
const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!RUN_INTEGRATION)("Auth Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const testPhone = "+2349012345678";
  const testPassword = "TestPass123";
  let otp: string;
  let accessToken: string;
  let refreshToken: string;

  describe("POST /api/auth/register", () => {
    it("registers a new user and returns OTP in dev mode", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          name: "Test Rider",
          phone: testPhone,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.phone).toBe(testPhone);
      expect(body.data.userId).toBeDefined();
      expect(body.data.otp).toBeDefined(); // dev mode returns OTP
      otp = body.data.otp;
    });

    it("rejects duplicate phone registration", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          name: "Another User",
          phone: testPhone,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("CONFLICT");
    });

    it("rejects invalid phone number", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          name: "Bad Phone",
          phone: "123",
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/verify-otp", () => {
    it("verifies OTP and returns tokens", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-otp",
        payload: {
          phone: testPhone,
          code: otp,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.user.phone).toBe(testPhone);
      accessToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
    });

    it("rejects invalid OTP", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/verify-otp",
        payload: {
          phone: testPhone,
          code: "000000",
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with valid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          phone: testPhone,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      // Update tokens for subsequent tests
      accessToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;
    });

    it("rejects wrong password", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          phone: testPhone,
          password: "WrongPass123",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects non-existent phone", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          phone: "+2340000000000",
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/auth/refresh-token", () => {
    it("refreshes tokens with valid refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/refresh-token",
        payload: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      // Old token should be revoked, save new ones
      const oldRefreshToken = refreshToken;
      accessToken = body.data.accessToken;
      refreshToken = body.data.refreshToken;

      // Old refresh token should now be rejected
      const retryResponse = await app.inject({
        method: "POST",
        url: "/api/auth/refresh-token",
        payload: { refreshToken: oldRefreshToken },
      });
      expect(retryResponse.statusCode).toBe(401);
    });

    it("rejects invalid refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/refresh-token",
        payload: { refreshToken: "invalid-token-string" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns success message (even for non-existent phone)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { phone: "+2340000000000" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.message).toContain("OTP has been sent");
    });

    it("returns OTP in dev mode for existing phone", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { phone: testPhone },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.otp).toBeDefined();
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("resets password with valid OTP", async () => {
      // Get OTP first
      const forgotResponse = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { phone: testPhone },
      });
      const resetOtp = forgotResponse.json().data.otp;

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: {
          phone: testPhone,
          code: resetOtp,
          newPassword: "NewPass456",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.message).toContain("Password reset");

      // Login with new password should work
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { phone: testPhone, password: "NewPass456" },
      });
      expect(loginResponse.statusCode).toBe(200);

      // Update tokens
      accessToken = loginResponse.json().data.accessToken;
      refreshToken = loginResponse.json().data.refreshToken;
    });
  });

  describe("POST /api/auth/logout", () => {
    it("logs out and revokes refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.message).toContain("Logged out");

      // Refresh token should now be invalid
      const refreshResponse = await app.inject({
        method: "POST",
        url: "/api/auth/refresh-token",
        payload: { refreshToken },
      });
      expect(refreshResponse.statusCode).toBe(401);
    });
  });
});

import { describe, it, expect } from "vitest";
import { generateOtp } from "./auth.service.js";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
} from "./auth.schema.js";

describe("Auth Service - generateOtp", () => {
  it("generates a 6-digit string", () => {
    const otp = generateOtp();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it("generates different OTPs on repeated calls", () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOtp()));
    // With 20 random 6-digit codes, extremely unlikely all are the same
    expect(otps.size).toBeGreaterThan(1);
  });

  it("generates codes in the 100000-999999 range", () => {
    for (let i = 0; i < 50; i++) {
      const otp = parseInt(generateOtp());
      expect(otp).toBeGreaterThanOrEqual(100000);
      expect(otp).toBeLessThanOrEqual(999999);
    }
  });
});

describe("Auth Schemas - registerSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerSchema.parse({
      name: "Adamu Usman",
      phone: "+2348012345678",
      password: "Password123",
    });
    expect(result.name).toBe("Adamu Usman");
    expect(result.role).toBe("rider"); // default
  });

  it("accepts driver role", () => {
    const result = registerSchema.parse({
      name: "Musa Ibrahim",
      phone: "+2348012345678",
      password: "Password123",
      role: "driver",
    });
    expect(result.role).toBe("driver");
  });

  it("accepts optional email", () => {
    const result = registerSchema.parse({
      name: "Test User",
      phone: "+2348012345678",
      password: "Password123",
      email: "test@example.com",
    });
    expect(result.email).toBe("test@example.com");
  });

  it("rejects short name", () => {
    expect(() =>
      registerSchema.parse({
        name: "A",
        phone: "+2348012345678",
        password: "Password123",
      })
    ).toThrow();
  });

  it("rejects short password", () => {
    expect(() =>
      registerSchema.parse({
        name: "Test User",
        phone: "+2348012345678",
        password: "Pass1",
      })
    ).toThrow();
  });

  it("rejects password without number", () => {
    expect(() =>
      registerSchema.parse({
        name: "Test User",
        phone: "+2348012345678",
        password: "Passwordonly",
      })
    ).toThrow();
  });

  it("rejects password without letter", () => {
    expect(() =>
      registerSchema.parse({
        name: "Test User",
        phone: "+2348012345678",
        password: "12345678",
      })
    ).toThrow();
  });

  it("rejects admin role", () => {
    expect(() =>
      registerSchema.parse({
        name: "Test User",
        phone: "+2348012345678",
        password: "Password123",
        role: "admin",
      })
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      registerSchema.parse({
        name: "Test User",
        phone: "+2348012345678",
        password: "Password123",
        email: "not-an-email",
      })
    ).toThrow();
  });
});

describe("Auth Schemas - loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.parse({
      phone: "+2348012345678",
      password: "Password123",
    });
    expect(result.phone).toBe("+2348012345678");
  });

  it("rejects missing password", () => {
    expect(() =>
      loginSchema.parse({ phone: "+2348012345678" })
    ).toThrow();
  });

  it("rejects empty password", () => {
    expect(() =>
      loginSchema.parse({ phone: "+2348012345678", password: "" })
    ).toThrow();
  });
});

describe("Auth Schemas - verifyOtpSchema", () => {
  it("accepts valid OTP data", () => {
    const result = verifyOtpSchema.parse({
      phone: "+2348012345678",
      code: "123456",
    });
    expect(result.code).toBe("123456");
  });

  it("rejects OTP that is not 6 digits", () => {
    expect(() =>
      verifyOtpSchema.parse({ phone: "+2348012345678", code: "12345" })
    ).toThrow();

    expect(() =>
      verifyOtpSchema.parse({ phone: "+2348012345678", code: "1234567" })
    ).toThrow();
  });
});

describe("Auth Schemas - forgotPasswordSchema", () => {
  it("accepts valid phone", () => {
    const result = forgotPasswordSchema.parse({ phone: "+2348012345678" });
    expect(result.phone).toBe("+2348012345678");
  });
});

describe("Auth Schemas - resetPasswordSchema", () => {
  it("accepts valid reset data", () => {
    const result = resetPasswordSchema.parse({
      phone: "+2348012345678",
      code: "123456",
      newPassword: "NewPass456",
    });
    expect(result.newPassword).toBe("NewPass456");
  });

  it("rejects weak new password", () => {
    expect(() =>
      resetPasswordSchema.parse({
        phone: "+2348012345678",
        code: "123456",
        newPassword: "weak",
      })
    ).toThrow();
  });
});

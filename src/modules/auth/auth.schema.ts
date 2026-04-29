import { z } from "zod";

// Phone must be normalizable to +234 format
const phoneSchema = z
  .string()
  .min(10, "Phone number is required")
  .max(15);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-zA-Z])(?=.*[0-9])/,
    "Password must contain at least one letter and one number"
  );

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: phoneSchema,
  password: passwordSchema,
  email: z.string().email().optional(),
  role: z.enum(["rider", "driver"]).default("rider"),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, "OTP must be 6 digits"),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
  allDevices: z.boolean().optional().default(false),
});

export const login2faSchema = z.object({
  tempToken: z.string().min(1, "Temporary token is required"),
  code: z.string().length(6, "TOTP code must be 6 digits"),
});

export const setup2faSchema = z.object({});

export const verify2faSchema = z.object({
  code: z.string().length(6, "TOTP code must be 6 digits"),
});

export const disable2faSchema = z.object({
  code: z.string().length(6, "TOTP code must be 6 digits"),
});

export const forgotPasswordSchema = z.object({
  phone: phoneSchema,
});

export const resetPasswordSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, "OTP must be 6 digits"),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type Login2faInput = z.infer<typeof login2faSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

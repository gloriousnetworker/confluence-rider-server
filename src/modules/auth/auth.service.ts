import bcrypt from "bcrypt";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import { db } from "../../config/database.js";
import * as schema from "../../db/schema/index.js";
import { AppError } from "../../middleware/error-handler.js";
import { normalizePhone, isValidPhone } from "../../utils/phone.js";
import { env } from "../../config/env.js";
import { sendOtpSms } from "../../services/sms.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../../services/email.js";
import type {
  RegisterInput,
  VerifyOtpInput,
  LoginInput,
  RefreshTokenInput,
  LogoutInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./auth.schema.js";

const SALT_ROUNDS = 10;

// --- OTP ---

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createOtp(phone: string): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(schema.otpCodes).values({
    phone,
    code,
    expiresAt,
  });

  // Send OTP via SMS (Termii). Falls back to console log if no API key.
  const smsResult = await sendOtpSms(phone, code);
  if (!smsResult.success) {
    console.warn(`[OTP] SMS delivery failed for ${phone}: ${smsResult.message}`);
  }

  // Always log in dev for testing convenience
  if (env.NODE_ENV !== "production") {
    console.log(`[OTP] ${phone}: ${code}`);
  }

  return code;
}

async function verifyOtp(
  phone: string,
  code: string
): Promise<void> {
  const [otp] = await db
    .select()
    .from(schema.otpCodes)
    .where(
      and(
        eq(schema.otpCodes.phone, phone),
        eq(schema.otpCodes.code, code),
        eq(schema.otpCodes.isUsed, false)
      )
    )
    .orderBy(schema.otpCodes.createdAt)
    .limit(1);

  if (!otp) {
    throw new AppError(422, "OTP_INVALID", "Invalid OTP code");
  }

  if (new Date() > otp.expiresAt) {
    throw new AppError(422, "OTP_EXPIRED", "OTP has expired");
  }

  if (otp.attempts >= 3) {
    throw new AppError(
      422,
      "OTP_MAX_ATTEMPTS",
      "Maximum OTP verification attempts exceeded"
    );
  }

  // Increment attempts
  await db
    .update(schema.otpCodes)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(schema.otpCodes.id, otp.id));

  // Mark as used
  await db
    .update(schema.otpCodes)
    .set({ isUsed: true })
    .where(eq(schema.otpCodes.id, otp.id));
}

// --- Refresh Tokens ---

async function createRefreshToken(userId: string): Promise<string> {
  const token = nanoid(64);
  const tokenHash = await bcrypt.hash(token, SALT_ROUNDS);
  const expiresAt = new Date(
    Date.now() + parseDuration(env.JWT_REFRESH_EXPIRY)
  );

  await db.insert(schema.refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

async function validateRefreshToken(
  token: string
): Promise<{ userId: string; tokenId: string }> {
  // Get all non-revoked, non-expired tokens
  const tokens = await db
    .select()
    .from(schema.refreshTokens)
    .where(
      and(
        eq(schema.refreshTokens.isRevoked, false)
      )
    );

  for (const stored of tokens) {
    if (new Date() > stored.expiresAt) continue;
    const matches = await bcrypt.compare(token, stored.tokenHash);
    if (matches) {
      return { userId: stored.userId, tokenId: stored.id };
    }
  }

  throw new AppError(401, "UNAUTHORIZED", "Invalid or expired refresh token");
}

async function revokeRefreshToken(tokenId: string): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ isRevoked: true })
    .where(eq(schema.refreshTokens.id, tokenId));
}

async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db
    .update(schema.refreshTokens)
    .set({ isRevoked: true })
    .where(eq(schema.refreshTokens.userId, userId));
}

// --- Auth Operations ---

export async function register(input: RegisterInput) {
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Invalid Nigerian phone number. Use +234 format."
    );
  }

  // Check if phone already exists
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);

  if (existing) {
    throw new AppError(409, "CONFLICT", "Phone number already registered");
  }

  // Check email uniqueness if provided
  if (input.email) {
    const [emailExists] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, input.email))
      .limit(1);

    if (emailExists) {
      throw new AppError(409, "CONFLICT", "Email already registered");
    }
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Create user + wallet in transaction
  const [user] = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(schema.users)
      .values({
        name: input.name,
        phone,
        email: input.email,
        passwordHash,
        role: input.role,
      })
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        phone: schema.users.phone,
        role: schema.users.role,
      });

    await tx.insert(schema.wallets).values({
      userId: newUser.id,
      balance: 0,
    });

    return [newUser];
  });

  // Generate OTP
  const otp = await createOtp(phone);

  // Send welcome email (non-blocking)
  if (input.email) {
    sendWelcomeEmail(input.email, input.name).catch(() => {});
  }

  return {
    userId: user.id,
    phone: user.phone,
    message: `OTP sent to ${phone}`,
    ...(env.NODE_ENV === "development" && { otp }),
  };
}

export async function verifyOtpAndActivate(
  input: VerifyOtpInput,
  signAccessToken: (payload: object) => string
) {
  const phone = normalizePhone(input.phone);

  await verifyOtp(phone, input.code);

  // Mark phone as verified
  const [user] = await db
    .update(schema.users)
    .set({ isPhoneVerified: true, updatedAt: new Date() })
    .where(eq(schema.users.phone, phone))
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      role: schema.users.role,
    });

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  // Issue tokens
  const accessToken = signAccessToken({
    sub: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  });
  const refreshToken = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
}

export async function login(
  input: LoginInput,
  signAccessToken: (payload: object) => string,
  signTempToken: (payload: object) => string
) {
  const phone = normalizePhone(input.phone);

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid phone number or password");
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid phone number or password");
  }

  if (!user.isPhoneVerified) {
    // Re-send OTP
    const otp = await createOtp(phone);
    return {
      requiresVerification: true,
      message: "Phone not verified. OTP resent.",
      ...(env.NODE_ENV === "development" && { otp }),
    };
  }

  // Check if 2FA is enabled
  if (user.is2faEnabled) {
    const tempToken = signTempToken({
      sub: user.id,
      scope: "2fa-verify",
    });

    return {
      requires2fa: true,
      tempToken,
    };
  }

  // Issue tokens
  const accessToken = signAccessToken({
    sub: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  });
  const refreshToken = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
}

export async function refreshTokens(
  input: RefreshTokenInput,
  signAccessToken: (payload: object) => string
) {
  const { userId, tokenId } = await validateRefreshToken(input.refreshToken);

  // Revoke old token (rotation)
  await revokeRefreshToken(tokenId);

  // Get user
  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "User not found");
  }

  // Issue new pair
  const accessToken = signAccessToken({
    sub: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  });
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken };
}

export async function logout(input: LogoutInput) {
  const { userId, tokenId } = await validateRefreshToken(input.refreshToken);

  if (input.allDevices) {
    await revokeAllRefreshTokens(userId);
  } else {
    await revokeRefreshToken(tokenId);
  }

  return { message: "Logged out successfully" };
}

// --- Password Recovery ---

export async function forgotPassword(input: ForgotPasswordInput) {
  const phone = normalizePhone(input.phone);

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.phone, phone))
    .limit(1);

  // Always return success (don't reveal if phone exists)
  if (!user) {
    return { message: `If this phone is registered, an OTP has been sent to ${phone}` };
  }

  const otp = await createOtp(phone);

  // Send password reset email if user has email (non-blocking)
  if (user.email) {
    sendPasswordResetEmail(user.email, user.name, otp).catch(() => {});
  }

  return {
    message: `If this phone is registered, an OTP has been sent to ${phone}`,
    ...(env.NODE_ENV === "development" && { otp }),
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  const phone = normalizePhone(input.phone);

  await verifyOtp(phone, input.code);

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

  const [user] = await db
    .update(schema.users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.users.phone, phone))
    .returning({ id: schema.users.id });

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  // Revoke all refresh tokens (force re-login)
  await revokeAllRefreshTokens(user.id);

  return { message: "Password reset successfully. Please log in." };
}

// --- 2FA ---

export async function get2faUser(userId: string) {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  return user;
}

export async function getExistingTotpSecret(userId: string) {
  const [existing] = await db
    .select()
    .from(schema.totpSecrets)
    .where(eq(schema.totpSecrets.userId, userId))
    .limit(1);

  return existing;
}

export async function saveTotpSecret(userId: string, secret: string) {
  await db.insert(schema.totpSecrets).values({
    userId,
    secret,
    isVerified: false,
  });
}

export async function verifyAndEnable2fa(
  userId: string,
  totpRecord: { id: string },
  backupCodes: string[]
) {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.totpSecrets)
      .set({ isVerified: true, backupCodes })
      .where(eq(schema.totpSecrets.id, totpRecord.id));

    await tx
      .update(schema.users)
      .set({ is2faEnabled: true, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  });
}

export async function disable2fa(userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.totpSecrets)
      .where(eq(schema.totpSecrets.userId, userId));

    await tx
      .update(schema.users)
      .set({ is2faEnabled: false, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  });
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.phone,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  return user;
}

/**
 * Issue access + refresh token pair for a user.
 * Used by login, verify-otp, and 2FA login completion.
 */
export async function issueTokenPair(
  userId: string,
  signAccessToken: (payload: object) => string
) {
  const user = await getUserById(userId);
  if (!user) {
    throw new AppError(404, "NOT_FOUND", "User not found");
  }

  const accessToken = signAccessToken({
    sub: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  });
  const refreshToken = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  };
}

export async function deleteTotpSecret(userId: string) {
  await db
    .delete(schema.totpSecrets)
    .where(eq(schema.totpSecrets.userId, userId));
}

// --- Helpers ---

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

import { env } from "../config/env.js";

interface SendSmsResult {
  success: boolean;
  message: string;
}

/**
 * Send an SMS via Termii API.
 * In development without Termii keys, logs to console instead.
 */
export async function sendSms(
  to: string,
  message: string
): Promise<SendSmsResult> {
  // If no Termii key configured, log to console (dev mode)
  if (!env.TERMII_API_KEY) {
    console.log(`[SMS - DEV MODE] To: ${to} | Message: ${message}`);
    return { success: true, message: "Logged to console (no Termii key)" };
  }

  try {
    const response = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.TERMII_API_KEY,
        to,
        from: env.TERMII_SENDER_ID,
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });

    const data = (await response.json()) as Record<string, any>;

    if (data.code === "ok" || response.ok) {
      console.log(`[SMS] Sent to ${to} via Termii`);
      return { success: true, message: "SMS sent" };
    }

    console.error(`[SMS] Termii error:`, data);
    return { success: false, message: String(data.message || "SMS delivery failed") };
  } catch (err) {
    console.error(`[SMS] Network error:`, err);
    return { success: false, message: "SMS service unavailable" };
  }
}

/**
 * Send OTP via SMS.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SendSmsResult> {
  const message = `Your Confluence Ride verification code is: ${otp}. Valid for ${env.OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;
  return sendSms(phone, message);
}

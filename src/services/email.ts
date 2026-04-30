import { Resend } from "resend";
import { env } from "../config/env.js";

let resend: Resend | null = null;

if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
  console.log("[Email] Resend configured");
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[Email - DEV] To: ${to} | Subject: ${subject}`);
    return;
  }

  try {
    await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err);
  }
}

// ─── Email Templates ───

const header = `
  <div style="background: linear-gradient(135deg, #1e3a8a, #16a34a); padding: 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-family: sans-serif;">Confluence Ride</h1>
    <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 14px; font-family: sans-serif;">Move Kogi Better</p>
  </div>
`;

const footer = `
  <div style="padding: 24px; text-align: center; color: #9ca3af; font-size: 12px; font-family: sans-serif; border-top: 1px solid #e5e7eb;">
    <p>&copy; 2026 Mega-Tech Solutions LTD. All rights reserved.</p>
    <p>Lokoja, Kogi State, Nigeria</p>
  </div>
`;

function wrap(content: string) {
  return `
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; font-family: sans-serif; border: 1px solid #e5e7eb;">
      ${header}
      <div style="padding: 32px 24px;">
        ${content}
      </div>
      ${footer}
    </div>
  `;
}

/**
 * Welcome email — sent after registration.
 */
export async function sendWelcomeEmail(to: string, name: string) {
  const html = wrap(`
    <h2 style="color: #111827; margin: 0 0 16px;">Welcome to Confluence Ride, ${name}! 🎉</h2>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px;">
      You've joined the ride-hailing platform built for the Confluence State.
      Whether you're heading to Ganaja Junction, Nataco, or catching an intercity ride to Abuja — we've got you covered.
    </p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="color: #166534; font-weight: bold; margin: 0 0 8px;">🎁 New User Bonus</p>
      <p style="color: #166534; margin: 0;">Use code <strong>CONFLUENCE50</strong> for 50% off your first ride!</p>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      <strong>What you can do:</strong>
    </p>
    <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px;">
      <li>Book bikes, kekes, cabs, and shared rides</li>
      <li>Negotiate fares with our smart bargain system</li>
      <li>Track your driver in real-time</li>
      <li>Pay with wallet, card, or cash</li>
    </ul>
    <p style="color: #4b5563; margin-top: 16px;">Ride the Confluence! 🚗</p>
  `);

  await sendEmail(to, "Welcome to Confluence Ride! 🚗", html);
}

/**
 * Trip receipt email — sent after trip completion.
 */
export async function sendTripReceiptEmail(
  to: string,
  data: {
    name: string;
    pickup: string;
    destination: string;
    rideType: string;
    fare: number;
    driverName: string;
    date: string;
    bookingId: string;
  }
) {
  const html = wrap(`
    <h2 style="color: #111827; margin: 0 0 16px;">Trip Receipt 🧾</h2>
    <p style="color: #4b5563; margin: 0 0 20px;">Hi ${data.name}, here's your trip summary:</p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 0 0 20px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Pickup</td>
          <td style="padding: 8px 0; color: #111827; text-align: right; font-weight: 600;">${data.pickup}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Destination</td>
          <td style="padding: 8px 0; color: #111827; text-align: right; font-weight: 600;">${data.destination}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Ride Type</td>
          <td style="padding: 8px 0; color: #111827; text-align: right;">${data.rideType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Driver</td>
          <td style="padding: 8px 0; color: #111827; text-align: right;">${data.driverName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Date</td>
          <td style="padding: 8px 0; color: #111827; text-align: right;">${data.date}</td>
        </tr>
        <tr style="border-top: 2px solid #e5e7eb;">
          <td style="padding: 12px 0 0; color: #111827; font-weight: bold; font-size: 16px;">Total</td>
          <td style="padding: 12px 0 0; color: #1e3a8a; text-align: right; font-weight: bold; font-size: 20px;">₦${data.fare.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <p style="color: #9ca3af; font-size: 12px;">Booking ID: ${data.bookingId}</p>
  `);

  await sendEmail(to, `Trip Receipt — ₦${data.fare.toLocaleString()} | Confluence Ride`, html);
}

/**
 * Password reset email — sent when user requests password reset.
 */
export async function sendPasswordResetEmail(to: string, name: string, otp: string) {
  const html = wrap(`
    <h2 style="color: #111827; margin: 0 0 16px;">Reset Your Password</h2>
    <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
      Hi ${name}, we received a request to reset your password. Use this code:
    </p>
    <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 20px;">
      <p style="color: #1e3a8a; font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0;">${otp}</p>
      <p style="color: #3b82f6; font-size: 14px; margin: 8px 0 0;">Valid for 5 minutes</p>
    </div>
    <p style="color: #4b5563; line-height: 1.6;">
      If you didn't request this, you can safely ignore this email.
    </p>
  `);

  await sendEmail(to, "Password Reset Code — Confluence Ride", html);
}

/**
 * Wallet topup confirmation email.
 */
export async function sendTopupConfirmationEmail(
  to: string,
  name: string,
  amount: number,
  newBalance: number
) {
  const html = wrap(`
    <h2 style="color: #111827; margin: 0 0 16px;">Wallet Top-Up Successful ✅</h2>
    <p style="color: #4b5563; margin: 0 0 20px;">Hi ${name}, your wallet has been credited.</p>
    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 20px;">
      <p style="color: #166534; font-size: 14px; margin: 0 0 4px;">Amount Added</p>
      <p style="color: #166534; font-size: 32px; font-weight: bold; margin: 0;">₦${amount.toLocaleString()}</p>
      <p style="color: #4ade80; font-size: 14px; margin: 8px 0 0;">New Balance: ₦${newBalance.toLocaleString()}</p>
    </div>
  `);

  await sendEmail(to, `₦${amount.toLocaleString()} added to your wallet — Confluence Ride`, html);
}

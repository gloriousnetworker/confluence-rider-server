import admin from "firebase-admin";
import { env } from "../config/env.js";

let firebaseApp: admin.app.App | null = null;

if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("[Push] Firebase Admin initialized");
}

/**
 * Send a push notification to a specific device token.
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!firebaseApp) {
    console.log(`[Push - DEV] To: ${fcmToken.substring(0, 20)}... | ${title}: ${body}`);
    return true;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      webpush: {
        notification: {
          title,
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        },
      },
    });
    console.log(`[Push] Sent to ${fcmToken.substring(0, 20)}...`);
    return true;
  } catch (err: any) {
    console.error(`[Push] Failed:`, err.message);
    return false;
  }
}

/**
 * Send push notification to multiple tokens.
 */
export async function sendPushToMultiple(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!firebaseApp || tokens.length === 0) return;

  try {
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data || {},
    });
  } catch (err) {
    console.error("[Push] Multicast failed:", err);
  }
}

// ─── Notification helpers ───

export async function notifyRideRequest(driverToken: string, pickup: string, fare: number) {
  await sendPushNotification(
    driverToken,
    "New Ride Request! 🚗",
    `Pickup: ${pickup} — ₦${fare}`,
    { type: "ride_request" }
  );
}

export async function notifyDriverAccepted(riderToken: string, driverName: string) {
  await sendPushNotification(
    riderToken,
    "Driver Accepted! ✅",
    `${driverName} is on the way to pick you up`,
    { type: "driver_accepted" }
  );
}

export async function notifyDriverArriving(riderToken: string) {
  await sendPushNotification(
    riderToken,
    "Driver Arriving 📍",
    "Your driver is almost there!",
    { type: "driver_arriving" }
  );
}

export async function notifyTripCompleted(riderToken: string, fare: number) {
  await sendPushNotification(
    riderToken,
    "Trip Completed! 🎉",
    `Your ride is complete. Fare: ₦${fare}`,
    { type: "trip_completed" }
  );
}

export async function notifySosAlert(token: string) {
  await sendPushNotification(
    token,
    "🚨 SOS Alert",
    "An emergency has been triggered on a ride",
    { type: "sos_alert" }
  );
}

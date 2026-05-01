import "dotenv/config";
import postgres from "postgres";

async function clearTestData() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL required"); process.exit(1); }

  const sql = postgres(url);

  console.log("Clearing test data...");

  await sql`DELETE FROM chat_messages`;
  await sql`DELETE FROM ratings`;
  await sql`DELETE FROM sos_alerts`;
  await sql`DELETE FROM shared_ride_riders`;
  await sql`DELETE FROM shared_rides`;
  await sql`DELETE FROM shuttle_bookings`;
  await sql`DELETE FROM delivery_orders`;
  await sql`DELETE FROM fare_offers`;
  await sql`DELETE FROM transactions`;
  await sql`DELETE FROM payments`;
  await sql`DELETE FROM bookings`;
  await sql`DELETE FROM notifications`;

  // Reset wallet balances to seed values
  await sql`UPDATE wallets SET balance = 8450 WHERE user_id = (SELECT id FROM users WHERE phone = '+2348012345678')`;
  await sql`UPDATE wallets SET balance = 0 WHERE user_id != (SELECT id FROM users WHERE phone = '+2348012345678')`;

  // Reset drivers to available
  await sql`UPDATE drivers SET is_available = true, is_online = true`;

  console.log("✅ Cleared: bookings, trips, transactions, notifications, ratings, deliveries, shuttle bookings, shared rides, chat");
  console.log("✅ Reset wallets and driver availability");

  await sql.end();
}

clearTestData().catch((e) => { console.error(e); process.exit(1); });

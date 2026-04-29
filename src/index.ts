import { createApp } from "./server.js";
import { env } from "./config/env.js";
import { sql } from "./config/database.js";

async function main() {
  // Test DB connection on startup
  try {
    const result = await sql`SELECT 1 as ok`;
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database connection failed:", err);
    console.error("DATABASE_URL starts with:", env.DATABASE_URL.substring(0, 30) + "...");
    process.exit(1);
  }

  const app = await createApp();

  // Railway injects PORT — use it, fallback to env config
  const port = parseInt(process.env.PORT || String(env.PORT), 10);

  try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Confluence Ride API running on port ${port}`);
    console.log(`Swagger docs at /docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

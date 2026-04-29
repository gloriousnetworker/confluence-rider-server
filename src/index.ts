import { createApp } from "./server.js";
import { env } from "./config/env.js";
import { sql } from "./config/database.js";
import { pushSchema } from "./db/migrate.js";

async function main() {
  // 1. Test DB connection
  try {
    await sql`SELECT 1 as ok`;
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }

  // 2. Push schema (create/update tables)
  await pushSchema();

  // 3. Start server
  const app = await createApp();
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

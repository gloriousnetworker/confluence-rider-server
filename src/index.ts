import { createApp } from "./server.js";
import { env } from "./config/env.js";

async function main() {
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

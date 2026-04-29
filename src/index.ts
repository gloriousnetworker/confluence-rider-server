import { createApp } from "./server.js";
import { env } from "./config/env.js";

async function main() {
  const app = await createApp();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    console.log(`Confluence Ride API running on http://localhost:${env.PORT}`);
    console.log(`Swagger docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

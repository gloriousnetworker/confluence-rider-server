/**
 * Programmatic schema push — runs before server startup.
 * Uses drizzle-kit push via CLI subprocess.
 */
import { execSync } from "child_process";

export async function pushSchema(): Promise<void> {
  console.log("Pushing database schema...");
  try {
    const output = execSync("npx drizzle-kit push --force", {
      encoding: "utf-8",
      stdio: "pipe",
      env: process.env,
    });
    console.log(output);
    console.log("Schema push complete");
  } catch (err: any) {
    console.error("Schema push failed:", err.stderr || err.message);
    // Don't exit — the tables might already exist
    console.log("Continuing with existing schema...");
  }
}

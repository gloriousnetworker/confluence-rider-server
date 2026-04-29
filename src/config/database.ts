import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema/index.js";
import { env } from "./env.js";

const connectionString =
  env.NODE_ENV === "test" && env.TEST_DATABASE_URL
    ? env.TEST_DATABASE_URL
    : env.DATABASE_URL;

const sql = postgres(connectionString, {
  max: env.NODE_ENV === "test" ? 5 : 20,
});

export const db = drizzle(sql, { schema });
export { sql };

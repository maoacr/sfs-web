import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";
import path from "path";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  dotenv.config({ path: path.resolve(__dirname, ".env") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const connectionString = process.env.DATABASE_URL || "";

/**
 * Cache global connection across HMR / Next.js serverless invocations
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const client =
  globalForDb.conn ??
  postgres(connectionString, {
    max: process.env.DB_MAX_CONNECTIONS ? Number(process.env.DB_MAX_CONNECTIONS) : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for Supabase transaction pooler (PgBouncer / Supavisor)
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };

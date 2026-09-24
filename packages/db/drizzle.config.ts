import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: "require",
  },
  verbose: true,
  strict: true,
});

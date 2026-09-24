import * as dotenv from "dotenv";
import path from "path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || "";

if (!url) {
  console.error("❌ ERROR: DATABASE_URL o DIRECT_URL no están configuradas.");
  process.exit(1);
}

// Para migraciones usamos conexión directa con max 1
const migrationClient = postgres(url, { max: 1 });
const db = drizzle(migrationClient);

async function runMigrations() {
  console.log("🚀 Aplicando migraciones Drizzle en la base de datos Supabase...");
  const migrationsFolder = path.resolve(__dirname, "../drizzle");
  
  await migrate(db, { migrationsFolder });
  
  console.log("✅ ¡Todas las tablas, índices y enums fueron creados exitosamente en Supabase!");
  await migrationClient.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("❌ Error aplicando migraciones:", err);
  process.exit(1);
});

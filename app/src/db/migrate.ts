import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";
import path from "path";

async function main() {
  console.log("Running database migrations...");
  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
  
  await migrate(db, { migrationsFolder });
  console.log("Database migrations applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed: ", err);
  process.exit(1);
});

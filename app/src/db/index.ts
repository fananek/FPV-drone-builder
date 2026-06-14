import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "./fpv-builder.db";

// Singleton pattern — reuse the connection across hot-reloads in dev
const globalForDb = globalThis as unknown as {
  _db: ReturnType<typeof drizzle> | undefined;
};

function createDb() {
  const sqlite = new Database(DATABASE_URL);
  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb._db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb._db = db;
}

export type DB = typeof db;

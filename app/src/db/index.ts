import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./fpv-builder.db";
if (
  !url.startsWith("libsql://") &&
  !url.startsWith("https://") &&
  !url.startsWith("http://") &&
  !url.startsWith("file:")
) {
  url = `file:${url}`;
}

const DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;

// Singleton pattern — reuse the connection across hot-reloads in dev
const globalForDb = globalThis as unknown as {
  _db: ReturnType<typeof drizzle> | undefined;
};

function createDb() {
  const client = createClient({
    url,
    authToken: DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = globalForDb._db ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb._db = db;
}

export type DB = typeof db;

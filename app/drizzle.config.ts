import { defineConfig } from "drizzle-kit";

let url = process.env.DATABASE_URL ?? "file:./fpv-builder.db";
if (url.startsWith("libsql://")) {
  url = url.replace("libsql://", "https://");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});

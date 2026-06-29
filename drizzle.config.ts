import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
    // DO Managed Postgres requires SSL. drizzle-kit accepts the URL's sslmode.
    ssl: url.includes("sslmode=require") ? "require" : undefined,
  },
  strict: true,
  verbose: true,
});

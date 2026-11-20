import { defineConfig } from "drizzle-kit";
const url = process.env.MIGRATION_DATABASE_URL;
if (!url)
  throw new Error(
    "Set MIGRATION_DATABASE_URL to the Supabase session/direct endpoint.",
  );
if (new URL(url).port === "6543")
  throw new Error(
    "Drizzle introspection requires the session/direct endpoint.",
  );
const connection = new URL(url);
if (
  connection.hostname.endsWith(".supabase.com") ||
  connection.hostname.endsWith(".supabase.co")
)
  connection.searchParams.set("sslmode", "verify-full");
export default defineConfig({
  schema: "./drizzle/schema.mjs",
  out: "./drizzle/review",
  dialect: "postgresql",
  dbCredentials: { url: connection.href },
  strict: true,
  verbose: false,
});

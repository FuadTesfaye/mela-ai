import type { PoolConfig } from "pg";
export function databaseConfig(
  connectionString: string,
  migration = false,
): PoolConfig {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("Use a PostgreSQL connection URL.");
  const supabase =
    url.hostname.endsWith(".supabase.com") ||
    url.hostname.endsWith(".supabase.co");
  if (migration && supabase && url.port === "6543")
    throw new Error(
      "Use the Supabase session pooler or direct endpoint for migrations.",
    );
  if (supabase) url.searchParams.set("sslmode", "verify-full");
  const configured = Number(process.env.DB_POOL_MAX);
  return {
    connectionString: url.href,
    max: migration
      ? 1
      : Number.isInteger(configured) && configured > 0 && configured <= 8
        ? configured
        : supabase
          ? 1
          : 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  };
}

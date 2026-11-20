import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { databaseConfig } from "../lib/database/config";
async function main() {
  const connection =
    process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!connection) throw new Error("Set MIGRATION_DATABASE_URL.");
  const pool = new Pool(databaseConfig(connection, true));
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(617230)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await readdir("migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const exists = await client.query(
        "SELECT name FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (exists.rowCount) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile("migrations/" + name, "utf8"));
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
          name,
        ]);
        await client.query("COMMIT");
        console.log("Applied", name);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(617230)");
    } finally {
      client.release();
      await pool.end();
    }
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Check MIGRATION_DATABASE_URL (session/direct connection) and PostgreSQL availability.",
  );
  process.exitCode = 1;
});

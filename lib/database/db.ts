import { Pool } from "pg";
import { databaseConfig } from "./config";
let pool: Pool | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
  return (pool ??= new Pool({
    ...databaseConfig(process.env.DATABASE_URL),
  }));
}
export async function closeDb() {
  await pool?.end();
  pool = undefined;
}

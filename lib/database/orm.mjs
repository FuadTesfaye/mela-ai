/** Optional adapter, enabled after the Drizzle dependencies are installed.
 * Keeps the existing pg pool; no second client or migration history.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { db } from "./db.ts";
import * as schema from "../../drizzle/schema.mjs";
export const orm = () => drizzle(db(), { schema });

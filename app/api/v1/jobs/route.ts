import { api, preflight } from "@/lib/security/http";
import jobs from "@/data/jobs.json";
import { db } from "@/lib/database/db";
export const OPTIONS = preflight;
export const GET = (request: Request) =>
  api(request, async () => {
    if (!process.env.DATABASE_URL) return { jobs, demo: true };
    const result = await db().query(
      "SELECT data FROM jobs ORDER BY id LIMIT 100",
    );
    return { jobs: result.rows.map((x) => x.data), demo: true };
  });

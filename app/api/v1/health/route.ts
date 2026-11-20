import { db } from "@/lib/database/db";
import { courses, defaultCourse } from "@/lib/courses/catalogue";
export async function GET() {
  let database = "unavailable";
  try {
    const result = await db().query("SELECT name FROM schema_migrations");
    database = result.rows.some(
      (r: { name: string }) => r.name === "005_telegram_queue.sql",
    )
      ? "ready"
      : "migrations-required";
  } catch {}
  const catalogue = courses.some((c) => c.id === defaultCourse())
    ? "ready"
    : "unavailable";
  const provider = process.env.AI_PROVIDER || "none";
  const providerConfigured =
    provider === "none" ||
    (provider === "gemini"
      ? !!process.env.GEMINI_API_KEY
      : provider === "local"
        ? !!process.env.OLLAMA_URL
        : provider === "cloud"
          ? !!process.env.CLOUD_AI_URL && !!process.env.CLOUD_AI_KEY
          : false);
  const tutorConfigured =
    !!process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_PASSWORD.length >= 12 &&
    !!process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32;
  const ok = database === "ready" && catalogue === "ready" && tutorConfigured;
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      database,
      catalogue,
      humanHelp: {
        database,
        tutorAuthentication: tutorConfigured ? "configured" : "missing",
      },
      defaultCourse: defaultCourse(),
      retrieval: "browser and approved public course sources",
      ai: {
        mode: provider,
        configuration: providerConfigured ? "configured" : "missing",
        connection: "not-probed",
        fallback: "source-only",
      },
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

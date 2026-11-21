import { ZodError } from "zod";
import { HttpError } from "./auth";
const limits = new Map<string, { count: number; reset: number }>();
function allowedOrigins() {
  return new Set([
    ...(
      process.env.ALLOWED_ORIGINS ||
      "http://localhost:3000,http://localhost:4173"
    )
      .split(",")
      .map((x) => x.trim()),
    new URL(process.env.APP_URL || "http://localhost:3000").origin,
  ]);
}
export function cors(request: Request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin) {
    if (
      !allowedOrigins().has(origin) &&
      origin !== new URL(request.url).origin &&
      !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)
    )
      throw new HttpError(403, "Origin is not allowed.");
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set(
      "Access-Control-Expose-Headers",
      "Content-Range, Accept-Ranges, Content-Length",
    );
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Range",
    );
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
  }
  return headers;
}
export function rateLimit(request: Request, max = 40) {
  const now = Date.now();
  if (limits.size > 10000)
    for (const [key, value] of limits)
      if (value.reset < now) limits.delete(key);
  if (limits.size > 10000) throw new HttpError(429, "Please try again later.");
  const address =
    process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
      : "local";
  const key = address + ":" + new URL(request.url).pathname;
  let value = limits.get(key);
  if (!value || value.reset < now) {
    value = { count: 0, reset: now + 60000 };
    limits.set(key, value);
  }
  if (++value.count > max)
    throw new HttpError(
      429,
      "Too many requests. Please try again in a minute.",
    );
}
export async function jsonBody(request: Request, max = 250000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON body required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function api(
  request: Request,
  handler: () => Promise<Response | unknown>,
  limit = 40,
) {
  let headers: Headers;
  try {
    headers = cors(request);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    rateLimit(request, limit);
    const result = await handler();
    const response =
      result instanceof Response ? result : Response.json(result);
    headers.forEach((v, k) => response.headers.set(k, v));
    return response;
  } catch (error) {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 503;
    const message =
      error instanceof HttpError
        ? error.message
        : error instanceof ZodError
          ? "Check the submitted fields."
          : "Service unavailable. Please try again shortly.";
    return Response.json(
      { error: message },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(request.headers.get("origin") &&
          (allowedOrigins().has(request.headers.get("origin")!) ||
            request.headers.get("origin") === new URL(request.url).origin)
            ? {
                "Access-Control-Allow-Origin": request.headers.get("origin")!,
                Vary: "Origin",
              }
            : {}),
        },
      },
    );
  }
}
export const preflight = (request: Request) => api(request, async () => null);

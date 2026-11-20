import { equal, HttpError } from "../security/auth";
export function requireOperation(request: Request) {
  const key = process.env.OPS_SECRET;
  if (!key || key.length < 32)
    throw new HttpError(503, "Operations are not configured.");
  if (!equal(request.headers.get("authorization") || "", `Bearer ${key}`))
    throw new HttpError(401, "Operations authentication required.");
}

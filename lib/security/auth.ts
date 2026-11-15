import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function token() {
  return randomBytes(32).toString("base64url");
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_NOT_CONFIGURED");
  return s;
}
export function createSession() {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  return (
    expires +
    "." +
    createHmac("sha256", secret()).update(expires).digest("base64url")
  );
}
export function isAdmin(request: Request) {
  try {
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("mela_session="))
      ?.slice(13);
    if (!cookie) return false;
    const [expires, signature] = cookie.split(".");
    return (
      Number(expires) > Date.now() &&
      equal(
        signature || "",
        createHmac("sha256", secret()).update(expires).digest("base64url"),
      )
    );
  } catch {
    return false;
  }
}
export function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
}
export function requireAdmin(request: Request) {
  if (!isAdmin(request)) throw new HttpError(401, "Tutor sign-in required.");
  if (!["GET", "HEAD"].includes(request.method)) {
    const expected = new URL(process.env.APP_URL || request.url).origin;
    if (request.headers.get("origin") !== expected)
      throw new HttpError(403, "Same-origin request required.");
  }
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

import { mkdir, open, rename, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { Readable } from "node:stream";
import { HttpError } from "../security/auth";
export const MAX_SIGNING_BYTES = 128 * 1024 * 1024;
export function storageRoot() {
  return resolve(
    process.env.SIGNING_STORAGE_DIR ||
      (process.env.SIGNING_STORAGE_PROVIDER === "supabase"
        ? "/tmp/mela-signing"
        : join(process.cwd(), "data-runtime/signing")),
  );
}
export function signingPath(name: string) {
  if (!/^[0-9a-f-]+\.(mp4|webm)$/.test(name))
    throw new HttpError(400, "Invalid media identifier.");
  return join(storageRoot(), name);
}
export function signingMime(contentType: string | null) {
  const mime = contentType?.split(";")[0].trim().toLowerCase();
  if (mime !== "video/mp4" && mime !== "video/webm")
    throw new HttpError(415, "Use MP4 or WebM video.");
  return mime;
}
export async function removeSigningMedia(name?: string | null) {
  if (!name) return;
  signingPath(name);
  if (process.env.SIGNING_STORAGE_PROVIDER === "supabase") {
    const response = await fetch(remoteSigningUrl(name), {
      method: "DELETE",
      headers: remoteHeaders(),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 404)
      throw new HttpError(503, "Could not remove remote signing media.");
  } else await unlink(signingPath(name)).catch(() => {});
}
export async function storeSigningMedia(request: Request, id: string) {
  const mime = signingMime(request.headers.get("content-type"));
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_SIGNING_BYTES))
    throw new HttpError(413, "Signing videos must be at most 128 MiB.");
  if (!request.body) throw new HttpError(400, "Video body is required.");
  await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
  const name = `${id}-${randomUUID()}.${mime === "video/mp4" ? "mp4" : "webm"}`;
  const final = signingPath(name),
    temp = final + ".part";
  const file = await open(temp, "wx", 0o600);
  let bytes = 0;
  let head = Buffer.alloc(0);
  const hash = createHash("sha256");
  const reader = request.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_SIGNING_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Signing videos must be at most 128 MiB.");
      }
      if (head.length < 32)
        head = Buffer.concat([
          head,
          Buffer.from(value).subarray(0, 32 - head.length),
        ]);
      hash.update(value);
      let offset = 0;
      while (offset < value.length) {
        const written = await file.write(value, offset, value.length - offset);
        if (!written.bytesWritten) throw new Error("Media write failed");
        offset += written.bytesWritten;
      }
    }
    const valid =
      mime === "video/webm"
        ? head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
        : head.toString("ascii", 4, 8) === "ftyp";
    if (!valid)
      throw new HttpError(
        400,
        "The video does not match its MP4/WebM content type.",
      );
    await file.sync();
    await file.close();
    await rename(temp, final);
    if (process.env.SIGNING_STORAGE_PROVIDER === "supabase") {
      try {
        const response = await fetch(remoteSigningUrl(name), {
          method: "POST",
          headers: {
            ...remoteHeaders(),
            "Content-Type": mime,
            "Content-Length": String(bytes),
            "x-upsert": "false",
          },
          body: Readable.toWeb(
            createReadStream(final),
          ) as ReadableStream<Uint8Array>,
          duplex: "half",
          signal: AbortSignal.timeout(60000),
        } as RequestInit);
        if (!response.ok)
          throw new HttpError(503, "Remote signing storage is unavailable.");
      } finally {
        await unlink(final).catch(() => {});
      }
    }
    return { name, mime, bytes, sha256: hash.digest("hex") };
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(temp).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
export function parseRange(range: string | null, size: number) {
  if (!range) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2]))
    throw new HttpError(416, "Invalid byte range.");
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!suffix) throw new HttpError(416, "Invalid byte range.");
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    start > end
  )
    throw new HttpError(416, "Byte range is outside this video.");
  return { start, end, partial: true };
}
export async function streamSigningMedia(
  request: Request,
  name: string,
  mime: string,
) {
  const path = signingPath(name);
  if (process.env.SIGNING_STORAGE_PROVIDER === "supabase") {
    const headers = remoteHeaders();
    if (request.headers.get("range"))
      headers.Range = request.headers.get("range")!;
    const response = await fetch(remoteSigningUrl(name, true), {
      headers,
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (![200, 206, 416].includes(response.status))
      throw new HttpError(
        response.status === 404 ? 404 : 503,
        "Signing media is unavailable.",
      );
    const result = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": signingMime(mime),
      "Accept-Ranges": "bytes",
    });
    for (const key of ["Content-Length", "Content-Range"]) {
      const value = response.headers.get(key);
      if (value) result.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: result,
    });
  }
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    throw new HttpError(404, "Signing media is unavailable.");
  }
  let range;
  try {
    range = parseRange(request.headers.get("range"), size);
  } catch {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }
  const stream = createReadStream(path, { start: range.start, end: range.end });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: range.partial ? 206 : 200,
    headers: {
      "Content-Type": signingMime(mime),
      "Content-Length": String(range.end - range.start + 1),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      ...(range.partial
        ? { "Content-Range": `bytes ${range.start}-${range.end}/${size}` }
        : {}),
    },
  });
}

function remoteHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new HttpError(503, "Signing storage is not configured.");
  return { Authorization: `Bearer ${key}`, apikey: key };
}
function remoteSigningUrl(name: string, authenticated = false) {
  const origin = new URL(
    process.env.SUPABASE_URL || "https://unconfigured.invalid",
  );
  if (origin.protocol !== "https:" || !origin.hostname.endsWith(".supabase.co"))
    throw new HttpError(503, "Set the Supabase project HTTPS URL.");
  const bucket = process.env.SUPABASE_SIGNING_BUCKET || "mela-signing";
  if (!/^[-a-z0-9]+$/.test(bucket))
    throw new HttpError(503, "Invalid signing bucket.");
  return new URL(
    `/storage/v1/object/${authenticated ? "authenticated/" : ""}${bucket}/${encodeURIComponent(name)}`,
    origin,
  ).href;
}

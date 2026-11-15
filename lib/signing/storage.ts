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
      join(process.cwd(), "data-runtime/signing"),
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
  if (name) await unlink(signingPath(name)).catch(() => {});
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

import { api, preflight } from "@/lib/security/http";
import { requireAdmin, isAdmin, HttpError } from "@/lib/security/auth";
import { uuid } from "@/lib/security/schemas";
import { db } from "@/lib/database/db";
import {
  storeSigningMedia,
  streamSigningMedia,
  removeSigningMedia,
} from "@/lib/signing/storage";
type Params = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const maxDuration = 180;
export const OPTIONS = preflight;
export const PUT = (request: Request, { params }: Params) =>
  api(
    request,
    async () => {
      requireAdmin(request);
      const id = uuid.parse((await params).id);
      const result = await db().query(
        "UPDATE signing_tracks SET status='uploading',upload_started_at=now() WHERE id=$1 AND (status IN ('draft','rejected') OR (status='uploading' AND upload_started_at<now()-interval '10 minutes')) RETURNING file_path",
        [id],
      );
      if (!result.rows[0])
        throw new HttpError(
          409,
          "Only draft or rejected recordings can be uploaded.",
        );
      let stored: Awaited<ReturnType<typeof storeSigningMedia>> | undefined;
      try {
        stored = await storeSigningMedia(request, id);
        await db().query(
          "UPDATE signing_tracks SET status='draft',file_path=$2,mime=$3,file_size=$4,media_sha256=$5,reviewer=null,reviewed_at=null,review_checks=null WHERE id=$1",
          [id, stored.name, stored.mime, stored.bytes, stored.sha256],
        );
        await removeSigningMedia(result.rows[0].file_path);
        return { uploaded: true, bytes: stored.bytes };
      } catch (error) {
        if (stored) await removeSigningMedia(stored.name);
        await db()
          .query(
            "UPDATE signing_tracks SET status='draft' WHERE id=$1 AND status='uploading'",
            [id],
          )
          .catch(() => {});
        throw error;
      }
    },
    5,
  );
export const GET = (request: Request, { params }: Params) =>
  api(
    request,
    async () => {
      const id = uuid.parse((await params).id);
      const result = await db().query(
        "SELECT status,file_path,mime FROM signing_tracks WHERE id=$1",
        [id],
      );
      const row = result.rows[0];
      if (
        !row ||
        !row.file_path ||
        (row.status !== "approved" && !isAdmin(request))
      )
        throw new HttpError(404, "Signing media is unavailable.");
      return streamSigningMedia(request, row.file_path, row.mime);
    },
    240,
  );

import { api, jsonBody, preflight } from "@/lib/security/http";
import { requireAdmin, HttpError } from "@/lib/security/auth";
import { uuid } from "@/lib/security/schemas";
import { db } from "@/lib/database/db";
import {
  reviewSigning,
  reviewSchema,
  publicTrack,
} from "@/lib/signing/service";
type Params = { params: Promise<{ id: string }> };
export const OPTIONS = preflight;
export const GET = (request: Request, { params }: Params) =>
  api(request, async () => {
    requireAdmin(request);
    const id = uuid.parse((await params).id);
    const result = await db().query(
      "SELECT * FROM signing_tracks WHERE id=$1",
      [id],
    );
    if (!result.rows[0]) throw new HttpError(404, "Signing draft not found.");
    return publicTrack(result.rows[0]);
  });
export const PATCH = (request: Request, { params }: Params) =>
  api(request, async () => {
    requireAdmin(request);
    return reviewSigning(
      uuid.parse((await params).id),
      reviewSchema.parse(await jsonBody(request, 6000)),
    );
  });

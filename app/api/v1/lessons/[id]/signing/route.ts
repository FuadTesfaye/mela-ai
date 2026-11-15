import { api, jsonBody, preflight } from "@/lib/security/http";
import { requireAdmin } from "@/lib/security/auth";
import { db } from "@/lib/database/db";
import {
  createSigningDraft,
  validLesson,
  publicTrack,
  signingDraftSchema,
} from "@/lib/signing/service";
type Params = { params: Promise<{ id: string }> };
export const OPTIONS = preflight;
export const GET = (request: Request, { params }: Params) =>
  api(request, async () => {
    requireAdmin(request);
    const { id } = await params;
    validLesson(id);
    const result = await db().query(
      "SELECT * FROM signing_tracks WHERE lesson_id=$1 ORDER BY created_at DESC LIMIT 100",
      [id],
    );
    return { tracks: result.rows.map(publicTrack) };
  });
export const POST = (request: Request, { params }: Params) =>
  api(
    request,
    async () => {
      requireAdmin(request);
      return Response.json(
        await createSigningDraft(
          (await params).id,
          signingDraftSchema.parse(await jsonBody(request, 5000)),
        ),
        { status: 201 },
      );
    },
    12,
  );

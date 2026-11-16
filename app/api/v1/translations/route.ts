import { api, jsonBody, preflight } from "@/lib/security/http";
import {
  translateItems,
  translationRequestSchema,
} from "@/lib/localization/service";
export const runtime = "nodejs";
export const maxDuration = 45;
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(
    request,
    async () =>
      translateItems(
        translationRequestSchema.parse(await jsonBody(request, 25000)),
      ),
    12,
  );

import { api, jsonBody, preflight } from "@/lib/security/http";
import { answerQuestion } from "@/lib/ai/answer";
import { askSchema } from "@/lib/security/schemas";
export const maxDuration = 90;
export const runtime = "nodejs";
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(request, async () =>
    answerQuestion(askSchema.parse(await jsonBody(request))),
  );

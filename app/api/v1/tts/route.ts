import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { HttpError } from "@/lib/security/auth";
import { synthesize } from "@/lib/ai/speech";
export const runtime = "nodejs";
export const maxDuration = 30;
export const OPTIONS = preflight;
const schema = z.object({
  text: z.string().trim().min(1).max(1000),
  language: z.enum(["en", "am", "om", "ti"]).default("en"),
});
/** MELA's voice: returns audio/wav (engine in the X-Mela-Voice header). */
export const POST = (request: Request) =>
  api(
    request,
    async () => {
      const input = schema.parse(await jsonBody(request, 8000));
      const speech = await synthesize(input.text, input.language);
      if (!speech) throw new HttpError(503, "No voice is available right now.");
      return new Response(new Uint8Array(speech.audio), {
        headers: { "Content-Type": "audio/wav", "X-Mela-Voice": speech.engine },
      });
    },
    120,
  );

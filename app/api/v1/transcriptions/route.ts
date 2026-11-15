import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { HttpError } from "@/lib/security/auth";
import { transcribeVideo } from "@/lib/media/transcript";
import { youtubeUrl } from "@/lib/media/youtube";
export const maxDuration = 120;
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(
    request,
    async () => {
      const data = z
        .object({
          videoUrl: z.string().url().max(2000),
          consent: z.literal(true),
          language: z.literal("en").default("en"),
        })
        .parse(await jsonBody(request, 4000));
      try {
        youtubeUrl(data.videoUrl);
      } catch {
        throw new HttpError(400, "Paste a public HTTPS YouTube video URL.");
      }
      if (!process.env.GEMINI_API_KEY)
        throw new HttpError(503, "Gemini transcription is not configured.");
      try {
        return await transcribeVideo(data.videoUrl);
      } catch (error) {
        if (error instanceof z.ZodError)
          throw new HttpError(
            502,
            "Gemini did not return a usable transcript. Try a shorter video with clear speech.",
          );
        const message =
          error instanceof Error && /^Gemini /.test(error.message)
            ? error.message
            : "The video could not be transcribed. Check Gemini configuration and try a public video with clear speech.";
        throw new HttpError(502, message);
      }
    },
    3,
  );

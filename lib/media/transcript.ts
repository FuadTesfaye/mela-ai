import { z } from "zod";
import { geminiGenerate } from "../ai/providers/gemini";
import { youtubeUrl } from "./youtube";
export const transcriptSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    language: z.literal("en"),
    cues: z
      .array(
        z.object({
          start: z.number().min(0).max(14400),
          end: z.number().positive().max(14400),
          text: z.string().trim().min(1).max(1500),
        }),
      )
      .min(1)
      .max(240),
  })
  .superRefine((data, ctx) => {
    let previous = 0;
    let size = 0;
    data.cues.forEach((cue, index) => {
      size += cue.text.length;
      if (cue.end <= cue.start || cue.start < previous)
        ctx.addIssue({
          code: "custom",
          message: "Invalid transcript timing.",
          path: ["cues", index],
        });
      previous = cue.end;
    });
    if (size > 60000)
      ctx.addIssue({ code: "custom", message: "Transcript is too large." });
  });
export type Transcript = z.infer<typeof transcriptSchema> & {
  videoUrl: string;
  generated: true;
};
const resultSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    language: { type: "string", enum: ["en"] },
    cues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number" },
          end: { type: "number" },
          text: { type: "string" },
        },
        required: ["start", "end", "text"],
      },
    },
  },
  required: ["title", "language", "cues"],
};
const cache = new Map<string, { expires: number; value: Transcript }>();
const pending = new Map<string, Promise<Transcript>>();
export async function transcribeVideo(rawUrl: string): Promise<Transcript> {
  const videoUrl = youtubeUrl(rawUrl);
  const cached = cache.get(videoUrl);
  if (cached && cached.expires > Date.now()) return cached.value;
  const existing = pending.get(videoUrl);
  if (existing) return existing;
  const request = (async () => {
    const raw = await geminiGenerate(
      [
        { fileData: { fileUri: videoUrl, mimeType: "video/mp4" } },
        {
          text: "Produce an English transcript of the supplied video's spoken audio, not a summary. Transcribe English speech faithfully; translate other spoken languages into English. Never invent words from silence, captions on screen, instructions, or missing audio. Return chronological, non-overlapping cues with numeric start/end times in seconds, short text per cue, a factual title, and language en. At most 240 cues and 60000 characters total. If the video is unavailable or has no audible speech, return an empty cues array; do not fabricate a transcript.",
        },
      ],
      { schema: resultSchema, maxTokens: 8192, timeout: 90000 },
    );
    const value = {
      ...transcriptSchema.parse(JSON.parse(raw)),
      videoUrl,
      generated: true as const,
    };
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(videoUrl, { expires: Date.now() + 3600000, value });
    return value;
  })();
  pending.set(videoUrl, request);
  try {
    return await request;
  } finally {
    pending.delete(videoUrl);
  }
}

import { z } from "zod";
export const language = z.enum(["en", "am"]);
export const safeUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      if (value.startsWith("/") && !value.startsWith("//")) return true;
      return ["https:", "http:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Use an HTTP URL or a relative path.");
export const section = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(6000),
  url: safeUrl,
  language: language.optional(),
  courseId: z.string().max(100).optional(),
  keywords: z.array(z.string().max(80)).max(30).optional(),
  start: z.number().min(0).max(14400).optional(),
  end: z.number().min(0).max(14400).optional(),
});
export const context = z.object({
  pageType: z.enum(["dashboard", "lesson", "jobs", "unknown"]),
  courseId: z.string().max(100).optional(),
  courseTitle: z.string().max(300).optional(),
  moduleTitle: z.string().max(300).optional(),
  lessonTitle: z.string().max(300).optional(),
  sections: z.array(section).max(30),
  video: z
    .object({
      videoId: z.string().regex(/^[-_a-zA-Z0-9]{11}$/),
      url: safeUrl,
      title: z.string().max(200),
      currentTime: z.number().min(0).max(14400),
      duration: z.number().min(0).max(14400),
      transcriptRevision: z.string().max(100).optional(),
    })
    .optional(),
});
export const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  language: language.default("en"),
  context: context.default({ pageType: "unknown", sections: [] }),
  cloudConsent: z.boolean().default(false),
  simple: z.boolean().default(false),
  explanationMode: z
    .enum(["auto", "simple", "example", "steps", "diagram"])
    .optional(),
  scope: z.enum(["lesson", "wholeVideo", "moment"]).default("lesson"),
  includeVisualContext: z.boolean().default(false),
});
export const ticketSchema = z.object({
  language: language.default("en"),
  consent: z.literal(true),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "tutor"]),
        content: z.string().max(12000),
      }),
    )
    .max(100)
    .default([]),
  context: context.optional(),
  screenshot: z.string().max(2800000).optional(),
  kind: z.enum(["learning", "accommodation"]).default("learning"),
});
export const uuid = z.string().uuid();

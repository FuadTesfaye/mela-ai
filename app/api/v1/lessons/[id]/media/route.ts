import { api, preflight } from "@/lib/security/http";
import { PROGRAMMING_LESSON, lessonIds } from "@/lib/media/lesson-catalog";
import { HttpError } from "@/lib/security/auth";
import { approvedSigning } from "@/lib/signing/service";
import { youtubeId } from "@/lib/media/youtube";
export const OPTIONS = preflight;
export const GET = (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) =>
  api(request, async () => {
    const lessonId = (await params).id;
    if (!(lessonIds as readonly string[]).includes(lessonId))
      throw new HttpError(404, "Lesson not found.");
    const defaultVideoUrl =
      lessonId === PROGRAMMING_LESSON.id
        ? PROGRAMMING_LESSON.videoUrl
        : process.env.COURSE_VIDEO_URL ||
          "https://www.youtube.com/watch?v=9hE5-98ZeCg";
    const selectedId =
      new URL(request.url).searchParams.get("videoId") ||
      youtubeId(defaultVideoUrl);
    if (!/^[-_a-zA-Z0-9]{11}$/.test(selectedId))
      throw new HttpError(400, "Invalid video ID.");
    const approved = await approvedSigning(lessonId, selectedId);
    const url = process.env.SIGN_LANGUAGE_VIDEO_URL;
    let safe = false;
    try {
      const parsed = new URL(
        url || "",
        process.env.APP_URL || "http://localhost:3000",
      );
      safe =
        parsed.protocol === "https:" ||
        (url?.startsWith("/") && !url.startsWith("//")) ||
        false;
    } catch {}
    const validated =
      safe &&
      process.env.SIGN_LANGUAGE_VALIDATED === "true" &&
      !!process.env.SIGN_LANGUAGE_REVIEWER &&
      /^[-_a-zA-Z0-9]{11}$/.test(
        process.env.SIGN_LANGUAGE_LESSON_VIDEO_ID || "",
      );
    return {
      defaultVideoUrl:
        lessonId === PROGRAMMING_LESSON.id
          ? PROGRAMMING_LESSON.videoUrl
          : process.env.COURSE_VIDEO_URL ||
            "https://www.youtube.com/watch?v=9hE5-98ZeCg",
      signLanguage:
        approved ||
        (validated
          ? {
              url,
              videoId: process.env.SIGN_LANGUAGE_LESSON_VIDEO_ID,
              language: "EthSL",
              reviewer: process.env.SIGN_LANGUAGE_REVIEWER,
              offsetSeconds: Math.max(
                0,
                Number(process.env.SIGN_LANGUAGE_OFFSET_SECONDS) || 0,
              ),
            }
          : null),
    };
  });

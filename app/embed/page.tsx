import { MelaCompanion } from "@/packages/sdk/src/react";
import { DEFAULT_LESSON_VIDEO } from "@/lib/media/lesson-catalog";
import { youtubeUrl } from "@/lib/media/youtube";
export default async function Embed({
  searchParams,
}: {
  searchParams: Promise<{ video?: string }>;
}) {
  const query = await searchParams;
  let video = DEFAULT_LESSON_VIDEO.videoUrl;
  if (query.video) {
    try {
      video = youtubeUrl(
        /^[-_a-zA-Z0-9]{11}$/.test(query.video)
          ? `https://www.youtube.com/watch?v=${query.video}`
          : query.video,
      );
    } catch {}
  }
  return (
    <main style={{ padding: 12, maxWidth: 1200, margin: "auto" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 12px" }}>
        MELA learning companion
      </h1>
      <MelaCompanion api="/api" videoUrl={video} />
    </main>
  );
}

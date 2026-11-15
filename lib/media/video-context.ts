import type { LearningContext, Section } from "../types";
export interface VideoCue {
  start: number;
  end: number;
  text: string;
}
export function transcriptRevision(url: string, cues: VideoCue[]) {
  let hash = 2166136261;
  for (const char of url + JSON.stringify(cues)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
/** Freeze evidence at question time. Playback ticks must never invalidate an in-flight question. */
export function videoEvidence(
  context: LearningContext,
  cues: VideoCue[],
  scope: "lesson" | "wholeVideo" | "moment",
): LearningContext {
  const video = context.video;
  if (!video || scope === "lesson")
    return {
      ...context,
      sections: context.sections.filter(
        (s) => !s.id.startsWith("video-") && !s.id.startsWith("moment-"),
      ),
    };
  const selected =
    scope === "moment"
      ? cues.filter(
          (c) =>
            c.end >= Math.max(0, video.currentTime - 45) &&
            c.start <= video.currentTime + 45,
        )
      : cues;
  const sections: Section[] = [];
  let group: VideoCue[] = [];
  let size = 0;
  const flush = () => {
    if (!group.length) return;
    const start = group[0].start,
      end = group[group.length - 1].end;
    const url = new URL(video.url);
    url.searchParams.set("t", String(Math.floor(start)));
    sections.push({
      id: `video-${video.videoId}-${Math.floor(start * 1000)}`,
      title: `English video transcript (AI-generated, unreviewed) · ${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, "0")}`,
      content: group.map((c) => c.text).join(" "),
      url: url.href,
      language: "en",
      courseId: context.courseId,
      start,
      end,
    });
    group = [];
    size = 0;
  };
  for (const cue of selected) {
    if (!cue.text.trim() || cue.end <= cue.start) continue;
    if (size + cue.text.length > 4500) flush();
    group.push(cue);
    size += cue.text.length;
  }
  flush();
  return { ...context, video: { ...video }, sections: sections.slice(0, 30) };
}

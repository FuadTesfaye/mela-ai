import { youtubeUrl } from "../../lib/media/youtube";
import type { Transcript } from "../../lib/media/transcript";
export function validTranscript(
  value: unknown,
  url: string,
): value is Transcript {
  if (!value || typeof value !== "object") return false;
  const data = value as Transcript;
  try {
    if (
      data.language !== "en" ||
      youtubeUrl(data.videoUrl) !== youtubeUrl(url) ||
      !Array.isArray(data.cues) ||
      !data.cues.length ||
      data.cues.length > 240
    )
      return false;
  } catch {
    return false;
  }
  let last = 0,
    size = 0;
  for (const cue of data.cues) {
    if (
      typeof cue.text !== "string" ||
      !cue.text.trim() ||
      cue.text.length > 1500 ||
      !Number.isFinite(cue.start) ||
      !Number.isFinite(cue.end) ||
      cue.start < last ||
      cue.end <= cue.start ||
      cue.end > 14400
    )
      return false;
    last = cue.end;
    size += cue.text.length;
  }
  return size <= 60000;
}

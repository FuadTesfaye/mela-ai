import { gesturePhase } from "../teacher/storyboard";
import type { TeacherGesture } from "../teacher/types";
export type Cue = { start: number; end: number; text: string };
export type Gesture =
  | "wave"
  | "point"
  | "compare"
  | "connect"
  | "count"
  | "explain"
  | "rest";
export function cueAt(cues: readonly Cue[], seconds: number): Cue | undefined {
  let lo = 0,
    hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cue = cues[mid];
    if (seconds < cue.start) hi = mid - 1;
    else if (seconds >= cue.end) lo = mid + 1;
    else return cue;
  }
}
export function gestureFor(text: string): Gesture {
  if (!text.trim()) return "rest";
  // English, Amharic (no \b for Ethiopic script) and Afaan Oromoo keywords.
  if (/\b(hello|welcome|hi|goodbye|akkam|nagaa|baga|nagaatti)\b|ሰላም|እንኳን|ደህና/i.test(text))
    return "wave";
  if (/\b(one|two|three|first|second|third|steps?|\d+|tokko|lama|sadii|jalqaba)\b|አንድ|ሁለት|ሶስት|መጀመሪያ/i.test(text))
    return "count";
  if (/\b(compare|versus|different|cloud|local|either|but|garuu|garaagara)\b|ግን|ልዩነት/i.test(text))
    return "compare";
  if (/\b(connect|together|network|join|combine|with|wajjin|walitti)\b|ጋር|አንድ ላይ/i.test(text))
    return "connect";
  if (/\b(look|screen|this|example|code|click|you|kana|kun|ilaali)\b|ይህ|እዚህ|እርስዎ/i.test(text))
    return "point";
  return "explain";
}
// Keeps the teacher signing through long answers instead of holding one pose.
const ROTATION: TeacherGesture[] = [
  "emphasize",
  "compare",
  "connect",
  "point",
  "emphasize",
  "count",
];
const hash = (text: string) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Deterministic caption-timed illustrations, not sign-language translation. */
export function captionMotion(
  cues: readonly Cue[],
  seconds: number,
  hint?: TeacherGesture,
) {
  const cue = cueAt(cues, seconds);
  if (!cue) return { gesture: "rest" as TeacherGesture, phase: 0.5, beat: 0 };
  const selected = gestureFor(cue.text);
  const keyword: TeacherGesture =
    selected === "wave"
      ? "welcome"
      : selected === "explain"
        ? hint || "emphasize"
        : selected;
  // One gesture about every 1.4 s: the keyword gesture first, then a varied
  // sequence so the hands keep moving for the whole caption.
  const elapsed = Math.max(0, seconds - cue.start);
  const cycles = Math.max(1, Math.round((cue.end - cue.start) / 1.4));
  const duration = (cue.end - cue.start) / cycles;
  const k = Math.min(cycles - 1, Math.floor(elapsed / duration));
  const start = cue.start + k * duration;
  const gesture =
    k === 0 ? keyword : ROTATION[(hash(cue.text) + k) % ROTATION.length];
  return {
    gesture,
    phase: gesturePhase(seconds, start, start + duration),
    beat: elapsed,
  };
}

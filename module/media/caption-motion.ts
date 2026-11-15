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
  if (/\b(hello|welcome|hi|goodbye)\b/i.test(text)) return "wave";
  if (/\b(one|two|three|first|second|third|steps?|\d+)\b/i.test(text))
    return "count";
  if (/\b(compare|versus|different|cloud|local|either)\b/i.test(text))
    return "compare";
  if (/\b(connect|together|network|join|combine)\b/i.test(text))
    return "connect";
  if (/\b(look|screen|this|example|code|click)\b/i.test(text)) return "point";
  return "explain";
}

/** Deterministic caption-timed illustrations, not sign-language translation. */
export function captionMotion(
  cues: readonly Cue[],
  seconds: number,
  hint?: TeacherGesture,
) {
  const cue = cueAt(cues, seconds);
  if (!cue) return { gesture: "rest" as TeacherGesture, phase: 0.5, beat: 0 };
  const selected = gestureFor(cue.text);
  const gesture: TeacherGesture =
    selected === "wave"
      ? "welcome"
      : selected === "explain"
        ? hint || "emphasize"
        : selected;
  const elapsed = Math.max(0, seconds - cue.start);
  const cycles = Math.max(1, Math.ceil((cue.end - cue.start) / 4));
  const duration = (cue.end - cue.start) / cycles;
  const start = cue.start + Math.floor(elapsed / duration) * duration;
  return {
    gesture,
    phase: gesturePhase(seconds, start, start + duration),
    beat: elapsed,
  };
}

import type { TeacherGesture } from "./types";
export interface TeachingSegment {
  id: string;
  start: number;
  end: number;
  title: string;
  explanation: string;
  gesture: TeacherGesture;
  diagram: { kind: "flow" | "merge" | "list"; labels: string[] };
  cueIds: number[];
}
export interface Storyboard {
  version: 1;
  videoId: string;
  segments: TeachingSegment[];
}
const gestures = new Set([
  "welcome",
  "point",
  "compare",
  "connect",
  "count",
  "emphasize",
  "rest",
]);
export function validStoryboard(value: unknown): value is Storyboard {
  if (!value || typeof value !== "object") return false;
  const data = value as Storyboard;
  if (
    data.version !== 1 ||
    !/^[-_a-zA-Z0-9]{11}$/.test(data.videoId) ||
    !Array.isArray(data.segments) ||
    data.segments.length > 20
  )
    return false;
  const ids = new Set<string>();
  let previous = 0;
  for (const item of data.segments) {
    if (
      !item ||
      typeof item.id !== "string" ||
      item.id.length > 80 ||
      ids.has(item.id) ||
      !Number.isFinite(item.start) ||
      !Number.isFinite(item.end) ||
      item.start < previous ||
      item.end <= item.start ||
      item.end > 14400 ||
      typeof item.title !== "string" ||
      item.title.length > 100 ||
      typeof item.explanation !== "string" ||
      item.explanation.length > 600 ||
      !gestures.has(item.gesture) ||
      !["flow", "merge", "list"].includes(item.diagram?.kind) ||
      !Array.isArray(item.diagram.labels) ||
      item.diagram.labels.length < 2 ||
      item.diagram.labels.length > 4 ||
      item.diagram.labels.some(
        (x) => typeof x !== "string" || x.length > 100,
      ) ||
      !Array.isArray(item.cueIds) ||
      item.cueIds.length > 12 ||
      item.cueIds.some((x) => !Number.isInteger(x) || x < 0 || x > 239)
    )
      return false;
    previous = item.end;
    ids.add(item.id);
  }
  return true;
}
export function segmentAt(
  data: Storyboard | undefined,
  videoId: string | undefined,
  seconds: number,
) {
  return data && data.videoId === videoId
    ? data.segments.find(
        (segment) => seconds >= segment.start && seconds < segment.end,
      )
    : undefined;
}
export function gesturePhase(seconds: number, start: number, end: number) {
  const duration = Math.max(0.001, end - start),
    ramp = Math.min(0.5, duration * 0.2),
    elapsed = Math.max(0, Math.min(duration, seconds - start));
  if (elapsed < ramp) return (0.18 * elapsed) / ramp;
  if (duration - elapsed < ramp)
    return 0.82 + 0.18 * (1 - (duration - elapsed) / ramp);
  return 0.18 + (0.64 * (elapsed - ramp)) / (duration - 2 * ramp);
}
const requests = new Map<string, Promise<Storyboard>>();
export function loadStoryboard(url: string) {
  const current = requests.get(url);
  if (current) return current;
  const pending = fetch(url, { signal: AbortSignal.timeout(12000) })
    .then(async (response) => {
      if (!response.ok)
        throw new Error("The lesson storyboard is unavailable.");
      const data: unknown = await response.json();
      if (!validStoryboard(data))
        throw new Error("The lesson storyboard is invalid.");
      return data;
    })
    .catch((error) => {
      requests.delete(url);
      throw error;
    });
  requests.set(url, pending);
  return pending;
}

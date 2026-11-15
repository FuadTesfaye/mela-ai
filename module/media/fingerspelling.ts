/** Experimental handshape renderer based on the American manual alphabet.
 * Reference: CDC/Cleary School ASL Finger Spelling Chart. This is fingerspelling,
 * not ASL grammar or validated sign-language translation. */
import type { Cue } from "./learning-preview";
export type SpellingFrame = {
  word: string;
  letter: string;
  phase: number;
  wordIndex: number;
};
export function spellingAt(
  cue: Cue | undefined,
  seconds: number,
): SpellingFrame | undefined {
  if (
    !cue ||
    seconds < cue.start ||
    seconds >= cue.end ||
    /^\s*[[(].*[\])]\s*$/.test(cue.text)
  )
    return;
  const words = cue.text.match(/[A-Za-z]+(?:'[A-Za-z]+)*/g) || [];
  const letters = words.map((word) =>
    word.replace(/[^A-Za-z]/g, "").toUpperCase(),
  );
  const total = letters.reduce((sum, word) => sum + word.length + 1, 0);
  if (!total) return;
  const position = Math.min(
    total - 0.00001,
    Math.max(0, ((seconds - cue.start) / (cue.end - cue.start)) * total),
  );
  let cursor = 0;
  for (let i = 0; i < letters.length; i++) {
    const count = letters[i].length + 1;
    if (position < cursor + count) {
      const local = position - cursor;
      const index = Math.min(letters[i].length - 1, Math.floor(local));
      return {
        word: words[i],
        letter: letters[i][index],
        phase: local - Math.floor(local),
        wordIndex: i,
      };
    }
    cursor += count;
  }
}
export interface Handshape {
  fingers: readonly number[];
  spread: number;
  rotation: number;
  thumb: string;
  offset: readonly number[];
}
const presets: Record<
  string,
  { fingers: number[]; spread?: number; rotation?: number; thumb?: string }
> = {
  A: { fingers: [0, 0, 0, 0], thumb: "M-8 9 L-15 -8" },
  B: { fingers: [1, 1, 1, 1], thumb: "M-10 9 L7 1" },
  C: { fingers: [2, 2, 2, 2], rotation: -30, thumb: "M-8 9 Q-20 5 -12 -5" },
  D: { fingers: [1, 0, 0, 0], thumb: "M-9 8 Q-16 -4 0 -9" },
  E: { fingers: [2, 2, 2, 2], thumb: "M-10 10 L9 5" },
  F: {
    fingers: [0, 1, 1, 1],
    spread: 1.4,
    thumb: "M-10 8 Q-19 -14 -8 -14 Q0 -13 -7 -5",
  },
  G: { fingers: [1, 0, 0, 0], rotation: -90, thumb: "M-9 9 L-16 -16" },
  H: { fingers: [1, 1, 0, 0], rotation: -90 },
  I: { fingers: [0, 0, 0, 1] },
  J: { fingers: [0, 0, 0, 1] },
  K: { fingers: [1, 1, 0, 0], spread: 1.6, thumb: "M-10 8 L-2 -16" },
  L: { fingers: [1, 0, 0, 0], thumb: "M-9 7 L-27 5" },
  M: { fingers: [0, 0, 0, 0], thumb: "M-9 9 L5 -4" },
  N: { fingers: [0, 0, 0, 0], thumb: "M-9 9 L0 -4" },
  O: { fingers: [2, 2, 2, 2], rotation: -25, thumb: "M-9 9 Q-22 0 -5 -13" },
  P: {
    fingers: [1, 1, 0, 0],
    spread: 1.6,
    rotation: 145,
    thumb: "M-10 8 L-2 -16",
  },
  Q: { fingers: [1, 0, 0, 0], rotation: 180, thumb: "M-9 9 L-23 -13" },
  R: { fingers: [1, 1, 0, 0], spread: -0.35 },
  S: { fingers: [0, 0, 0, 0], thumb: "M-10 7 L7 -4" },
  T: { fingers: [0, 0, 0, 0], thumb: "M-10 9 L-6 -8" },
  U: { fingers: [1, 1, 0, 0] },
  V: { fingers: [1, 1, 0, 0], spread: 1.8 },
  W: { fingers: [1, 1, 1, 0], spread: 1.5 },
  X: { fingers: [2, 0, 0, 0], thumb: "M-9 8 L7 2" },
  Y: { fingers: [0, 0, 0, 1], spread: 1.3, thumb: "M-9 7 L-27 -4" },
  Z: { fingers: [1, 0, 0, 0] },
};
export function handshapeFor(letter: string, phase = 0): Handshape | undefined {
  const value = presets[letter.toUpperCase()];
  if (!value) return;
  let offset = [0, 0];
  if (letter.toUpperCase() === "J")
    offset = [Math.sin(phase * Math.PI) * -13, phase * 15];
  if (letter.toUpperCase() === "Z")
    offset =
      phase < 0.33
        ? [phase * 40, 0]
        : phase < 0.67
          ? [13 - (phase - 0.33) * 40, (phase - 0.33) * 28]
          : [(phase - 0.67) * 40, 10];
  return {
    ...value,
    spread: value.spread ?? 1,
    rotation: value.rotation ?? 0,
    thumb: value.thumb || "M-9 9 L5 1",
    offset,
  };
}

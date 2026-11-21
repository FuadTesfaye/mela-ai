/** Sign-language box for spoken answers: the same learning panel used by the
 * course player (visual teacher, English fingerspelling preview, illustrative
 * gestures and captions), timed to the answer as it is read aloud.
 * Illustrative only — not validated EthSL translation. */
import { mountLearningPreview, type Cue } from "../media/learning-preview";

const WORDS_PER_SECOND = 2.6;

type TimedCue = Cue & { from: number; to: number };

export function buildCues(text: string, rate = 1): TimedCue[] {
  const cues: TimedCue[] = [];
  const sentences = text.match(/[^.!?።፧\n]+[.!?።፧]*/g) || [];
  let seconds = 0.2;
  let cursor = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += 12) {
      const chunk = words.slice(i, i + 12).join(" ");
      const from = text.indexOf(words[i], cursor);
      const to = from + chunk.length;
      cursor = Math.max(cursor, to);
      const duration = Math.max(
        1.2,
        chunk.split(" ").length / (WORDS_PER_SECOND * rate),
      );
      cues.push({
        start: seconds,
        end: seconds + duration,
        text: chunk,
        from,
        to,
      });
      seconds += duration + 0.15;
    }
  }
  return cues;
}

export function mountSignBox(
  host: HTMLElement,
  options: { runtimeUrl: string; storyboardUrl: string },
) {
  const box = document.createElement("div");
  box.className = "sign-box";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Sign language box");
  const label = document.createElement("div");
  label.className = "sign-label";
  label.textContent = "🤟 SIGN LANGUAGE · VISUAL AID";
  const content = document.createElement("div");
  content.className = "sign-content";
  box.append(label, content);
  host.append(box);

  let cues: TimedCue[] = [];
  let started = 0;
  let playing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let language: "en" | "am" = "en";
  const duration = () => (cues.length ? cues[cues.length - 1].end + 0.3 : 0);
  const seconds = () =>
    playing ? (performance.now() - started) / 1000 : duration();

  const preview = mountLearningPreview(content, {
    onGenerate: () => {},
    renderer: "auto",
    runtimeUrl: options.runtimeUrl,
    storyboardUrl: options.storyboardUrl,
  });
  const push = () => {
    preview.update({
      cues,
      displayCues: language === "am" ? cues : undefined,
      language,
      seconds: Math.min(seconds(), duration()),
      playing,
      rate: 1,
      visible: true,
      sourceLabel: "ANSWER CAPTIONS",
      playback: "ready",
    });
    // Answer-specific wording (the shared panel is written for course videos).
    const hint = content.querySelector(".live-caption small");
    if (hint) hint.textContent = "MELA's answer, timed to the voice.";
    const words = content.querySelector(".caption-words");
    if (words && !playing)
      words.textContent = cues.length
        ? cues.map((c) => c.text).join(" ")
        : "Answers appear here as captions.";
    const motion = content.querySelector(".motion-state");
    if (motion && /video/i.test(motion.textContent || ""))
      motion.textContent = playing
        ? "Signing along with the answer"
        : "Waiting for the next answer";
  };
  const tick = () => {
    clearTimeout(timer);
    if (playing && seconds() >= duration()) playing = false;
    push();
    if (playing) timer = setTimeout(tick, 120);
  };
  push();

  return {
    element: box,
    /** Start showing an answer. Call sync() from speech boundary events. */
    play(text: string, lang: "en" | "am" = "en") {
      language = lang;
      cues = buildCues(text);
      started = performance.now();
      playing = cues.length > 0;
      tick();
    },
    /** Keep the box in step with speech: charIndex from SpeechSynthesis boundary. */
    sync(charIndex: number) {
      if (!playing) return;
      const cue = cues.find((c) => charIndex >= c.from && charIndex <= c.to);
      if (!cue) return;
      const now = seconds();
      if (now < cue.start || now >= cue.end)
        started = performance.now() - cue.start * 1000;
    },
    stop() {
      playing = false;
      tick();
    },
    dispose() {
      clearTimeout(timer);
      preview.dispose();
      box.remove();
    },
  };
}

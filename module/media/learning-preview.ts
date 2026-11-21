/** Captions are transcript evidence. Procedural gestures below are illustrative,
 * not a signed-language vocabulary or an English-to-EthSL translation model. */
import { mountTeacherPresentation } from "../teacher/presentation";
import type { RendererPreference } from "../teacher/types";
import { loadFeature } from "../localization/runtime";
import type * as Spelling from "./fingerspelling";
import { cueAt, gestureFor, type Cue } from "./caption-motion";
export { cueAt, gestureFor, type Cue, type Gesture } from "./caption-motion";
const ns = "http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  return node;
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
export type PreviewState = {
  cues: readonly Cue[];
  displayCues?: readonly Cue[];
  language?: "en" | "am";
  seconds: number;
  playing: boolean;
  rate: number;
  visible: boolean;
  sourceLabel?: string;
  videoId?: string;
  playback?: "not-loaded" | "loading" | "ready";
};
export function mountLearningPreview(
  host: HTMLElement,
  options: {
    visual?: HTMLElement;
    onGenerate: () => void;
    onModeChange?: (visible: boolean) => void;
    renderer?: RendererPreference;
    runtimeUrl?: string;
    storyboardUrl?: string;
    onResume?: (seconds: number) => boolean | void;
  },
) {
  let spellingModule: typeof Spelling | undefined;
  const approved = !!options.visual;
  const wrapper = el("div", undefined, "learning-preview");
  const controls = el("label", "View ", "preview-mode");
  const select = el("select");
  select.setAttribute("aria-label", "Learning panel view");
  for (const [value, label] of [
    ["both", approved ? "Captions + interpreter" : "Captions + teacher"],
    ["captions", "Captions only"],
    ["avatar", approved ? "Interpreter only" : "Teacher only"],
  ]) {
    const option = el("option", label);
    option.value = value;
    select.append(option);
  }
  select.value = "both";
  controls.append(select);
  const visual = options.visual || el("div", undefined, "gesture-viewport");
  const note = el(
    "p",
    "Experimental gesture preview · illustrative movement, not EthSL translation.",
    "gesture-note",
  );
  const caption = el("section", undefined, "live-caption");
  caption.setAttribute("aria-label", "Synchronized English captions");
  const stamp = el("span", "00:00", "caption-time");
  const heading = el("div", undefined, "caption-heading");
  const sourceLabel = el("strong", "AI CAPTIONS");
  heading.append(sourceLabel, stamp);
  const words = el(
    "p",
    "Generate captions to follow this lesson.",
    "caption-words",
  );
  const generate = el("button", "Generate AI captions", "preview-generate");
  generate.type = "button";
  generate.onclick = options.onGenerate;
  const hint = el(
    "small",
    "Generated from the video's audio. Review for accuracy.",
  );
  caption.append(heading, words, generate, hint);
  const description = el("p", "Waiting for captions", "gesture-description");
  const animationMode = el("select");
  animationMode.setAttribute("aria-label", "Animation style");
  for (const [value, label] of [
    ["teacher", "Visual teacher"],
    ["spelling", "English fingerspelling (preview)"],
    ["gestures", "Illustrative gestures"],
  ]) {
    const option = el("option", label);
    option.value = value;
    animationMode.append(option);
  }
  animationMode.value = "teacher";
  const motion = el("button", "Pause animation", "motion-toggle");
  motion.type = "button";
  const motionState = el("p", "Paused with video", "motion-state");
  const letterLabel = el("p", "", "spelling-label");
  letterLabel.setAttribute("aria-hidden", "true");
  const animationControls = el("div", undefined, "animation-controls");
  animationControls.append(animationMode, motion, motionState);
  const reference = el("a", "Alphabet reference", "alphabet-reference");
  reference.href =
    "https://www.cdc.gov/hearing-loss-children-guide/media/pdfs/fingerspelling.pdf";
  reference.target = "_blank";
  reference.rel = "noopener noreferrer";

  wrapper.append(controls, visual);
  if (!approved)
    wrapper.append(
      letterLabel,
      note,
      description,
      animationControls,
      reference,
    );
  wrapper.append(caption);
  host.prepend(wrapper);
  let state: PreviewState = {
    cues: [],
    seconds: 0,
    playing: false,
    rate: 1,
    visible: false,
  };
  let anchor = Date.now(),
    frame: number | undefined,
    disposed = false,
    generating = false,
    failure = "",
    lastText = "";
  const reduced =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : undefined;
  let motionOverride: boolean | undefined;
  const motionEnabled = () => motionOverride ?? !reduced?.matches;
  let root: SVGSVGElement | undefined,
    arms: SVGPathElement[] = [],
    hands: SVGGElement[] = [];
  if (!approved) {
    root = svg("svg", {
      viewBox: "0 0 320 320",
      role: "img",
      "aria-label":
        "Animated person with experimental English fingerspelling and illustrative gestures",
    });
    root.append(
      svg("rect", { width: 320, height: 320, rx: 16, fill: "#eaf3f6" }),
      svg("circle", { cx: 160, cy: 139, r: 108, fill: "#d7e9ed" }),
    );
    root.append(
      svg("ellipse", { cx: 160, cy: 308, rx: 88, ry: 11, fill: "#c2d7dd" }),
    );
    root.append(
      svg("path", {
        d: "M91 316 L99 191 Q103 166 139 166 L181 166 Q217 166 221 191 L229 316Z",
        fill: "#164c65",
      }),
    );
    root.append(
      svg("path", {
        d: "M139 163 L139 147 L181 147 L181 163 Q160 186 139 163",
        fill: "#98613f",
      }),
    );
    root.append(
      svg("ellipse", { cx: 160, cy: 106, rx: 49, ry: 59, fill: "#412c25" }),
      svg("ellipse", { cx: 112, cy: 116, rx: 8, ry: 13, fill: "#aa744f" }),
      svg("ellipse", { cx: 208, cy: 116, rx: 8, ry: 13, fill: "#aa744f" }),
    );
    root.append(
      svg("path", {
        d: "M116 94 Q116 63 160 64 Q204 63 204 94 L200 125 Q191 157 160 158 Q129 157 120 125Z",
        fill: "#b78158",
      }),
    );
    root.append(
      svg("path", {
        d: "M113 99 Q101 39 158 40 Q218 38 208 101 L195 81 Q175 89 139 72 L123 99Z",
        fill: "#292824",
      }),
    );
    for (const x of [141, 179]) {
      root.append(
        svg("path", {
          d: `M${x - 9} 99 Q${x} 95 ${x + 9} 99`,
          stroke: "#40302a",
          "stroke-width": 3,
          fill: "none",
          "stroke-linecap": "round",
        }),
        svg("ellipse", { cx: x, cy: 108, rx: 4, ry: 5, fill: "#252c30" }),
      );
    }
    root.append(
      svg("path", {
        d: "M159 108 L155 123 Q160 126 166 122 M145 136 Q160 146 176 135",
        fill: "none",
        stroke: "#7c4738",
        "stroke-width": 3,
        "stroke-linecap": "round",
      }),
    );
    for (let i = 0; i < 2; i++) {
      const arm = svg("path", {
        fill: "none",
        stroke: "#164c65",
        "stroke-width": 20,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      arms.push(arm);
      root.append(arm);
      const hand = svg("g", { "data-hand": i });
      hand.append(
        svg("rect", {
          x: -10,
          y: -11,
          width: 20,
          height: 25,
          rx: 8,
          fill: "#b78158",
        }),
      );
      // Five visible digits; finger articulation is decorative, not linguistic.
      for (let j = 0; j < 4; j++)
        hand.append(
          svg("path", {
            d: `M${-8 + j * 5} -4 L${-8 + j * 5} ${-22 - Math.sin((j / 3) * Math.PI) * 5}`,
            stroke: "#b78158",
            "stroke-width": 4,
            "stroke-linecap": "round",
          }),
        );
      hand.append(
        svg("path", {
          d: "M-6 5 L-18 -5",
          stroke: "#b78158",
          "stroke-width": 5,
          "stroke-linecap": "round",
        }),
      );
      hands.push(hand);
      root.append(hand);
    }
    visual.append(root);
  }
  const teaching =
    !approved && options.runtimeUrl && options.storyboardUrl
      ? mountTeacherPresentation(visual, wrapper, caption, {
          runtimeUrl: options.runtimeUrl,
          storyboardUrl: options.storyboardUrl,
          renderer: options.renderer,
          onResume: options.onResume,
          changed: () => {
            if (!disposed) refresh();
          },
        })
      : undefined;
  function pose(seconds: number, cue?: Cue) {
    if (!root) return;
    const lesson =
      animationMode.value === "teacher" ? teaching?.tick(seconds) : undefined;
    const gesture = lesson
      ? (
          {
            welcome: "wave",
            point: "point",
            compare: "compare",
            connect: "connect",
            count: "count",
            emphasize: "explain",
            rest: "rest",
          } as const
        )[lesson.frame.gesture]
      : gestureFor(cue?.text || "");
    root.setAttribute("data-gesture", gesture);
    const spelling =
      animationMode.value === "spelling"
        ? spellingModule?.spellingAt(cue, seconds)
        : undefined;
    const shape = spelling
      ? spellingModule?.handshapeFor(spelling.letter, spelling.phase)
      : undefined;
    root.setAttribute("data-letter", spelling?.letter || "");
    letterLabel.textContent = spelling
      ? `${spelling.word} · ${spelling.letter}`
      : lesson?.segment?.title ||
        (animationMode.value === "teacher" ? "Visual teacher" : "");

    const poseTime = lesson?.frame.seconds ?? seconds;
    const local = lesson
      ? (lesson.frame.beat ?? 0)
      : cue
        ? Math.max(0, poseTime - cue.start)
        : 0;
    const beat = gesture === "rest" ? 0 : Math.sin(local * 3.2);
    const slow = Math.sin(local * 1.8);
    let left = [111, 251, -10],
      right = [209, 251, 10];
    if (gesture === "wave") right = [232 + beat * 10, 111, -20 + beat * 22];
    if (gesture === "point") {
      left = [128, 224, -25];
      right = [224, 173, -15 + beat * 6];
    }
    if (gesture === "count") {
      left = [130, 222, -25];
      right = [210, 163, beat * 8];
    }
    if (gesture === "compare") {
      left = [86, 207 + beat * 10, -55];
      right = [234, 207 - beat * 10, 55];
    }
    if (gesture === "connect") {
      left = [141 - slow * 8, 211, -35];
      right = [179 + slow * 8, 211, 35];
    }
    if (gesture === "explain") {
      left = [104 - slow * 7, 215 + beat * 8, -35];
      right = [216 + slow * 7, 215 - beat * 8, 35];
    }
    if (shape) {
      left = [115, 250, -8];
      right = [
        212 + shape.offset[0],
        161 + shape.offset[1],
        shape.rotation + Math.sin((spelling?.phase || 0) * Math.PI) * 2,
      ];
    }
    [left, right].forEach(([x, y, rotation], i) => {
      const shoulder = i ? 211 : 109;
      const elbow = i ? 234 : 86;
      arms[i].setAttribute("d", `M${shoulder} 186 Q${elbow} 242 ${x} ${y}`);
      hands[i].setAttribute(
        "transform",
        `translate(${x} ${y}) rotate(${rotation})`,
      );
      const numeral = /\b([1-5]|one|two|three|four|five|first|second|third)\b/i
        .exec(cue?.text || "")?.[1]
        ?.toLowerCase();
      const count =
        Number(numeral) ||
        ({
          one: 1,
          two: 2,
          three: 3,
          four: 4,
          five: 5,
          first: 1,
          second: 2,
          third: 3,
        }[numeral || ""] ??
          3);
      const paths = Array.from(hands[i].querySelectorAll("path"));
      paths.slice(0, 4).forEach((finger, j) => {
        const extended =
          i === 0 ||
          (gesture !== "point" && gesture !== "count") ||
          j < (gesture === "point" ? 1 : count);
        const x = -8 + j * 5;
        const mode = i === 1 && shape ? shape.fingers[j] : extended ? 1 : 0;
        const spread =
          i === 1 && shape ? (j - 1.5) * (shape.spread - 1) * 5 : 0;
        finger.setAttribute(
          "d",
          mode === 1
            ? `M${x} -4 L${x + spread} ${-22 - Math.sin((j / 3) * Math.PI) * 5}`
            : mode === 2
              ? `M${x} -4 Q${x + spread - 5} -25 ${x + 5} -12`
              : `M${x} -4 Q${x + 4} -12 ${x + 2} -1`,
        );
      });
      paths[4]?.setAttribute(
        "d",
        i === 1 && shape ? shape.thumb : "M-6 5 L-18 -5",
      );
    });
    description.textContent = lesson
      ? lesson.segment
        ? "Two-handed illustration of the current concept."
        : "Follow the captions. No authored concept is available at this moment."
      : spelling
        ? `Cue-timed spelling · estimated word timing`
        : gesture === "rest"
          ? "Waiting for speech"
          : `Illustrative gesture · ${gesture}`;
  }
  function draw() {
    const time = teaching?.isExplaining()
      ? teaching.sourceTime()
      : state.seconds;
    const cue = cueAt(state.cues, time);
    pose(
      animationMode.value === "teacher"
        ? time
        : !motionEnabled() && cue
          ? cue.start
          : time,
      cue,
    );
  }
  function stop() {
    if (frame !== undefined && typeof cancelAnimationFrame === "function")
      cancelAnimationFrame(frame);
    frame = undefined;
  }
  function animate() {
    frame = undefined;
    if (
      disposed ||
      approved ||
      !wrapper.isConnected ||
      !state.visible ||
      (!state.playing && !teaching?.isReplaying()) ||
      (animationMode.value === "teacher" &&
        teaching &&
        !teaching.isOnscreen()) ||
      select.value === "captions" ||
      !motionEnabled()
    )
      return;
    const seconds = state.seconds + ((Date.now() - anchor) / 1000) * state.rate;
    pose(
      seconds,
      cueAt(
        state.cues,
        teaching?.isExplaining() ? teaching.sourceTime() : seconds,
      ),
    );
    if (typeof requestAnimationFrame === "function")
      frame = requestAnimationFrame(animate);
  }
  let lastVisual: boolean | undefined;
  function refresh() {
    wrapper.dataset.mode = select.value;
    const captions = select.value !== "avatar",
      showVisual = select.value !== "captions";
    visual.hidden = !showVisual;
    note.hidden = !showVisual;
    description.hidden = !showVisual || animationMode.value === "teacher";
    letterLabel.hidden = !showVisual || animationMode.value === "teacher";
    caption.hidden = !captions;
    if (lastVisual !== showVisual) {
      lastVisual = showVisual;
      options.onModeChange?.(showVisual);
    }
    teaching?.update(
      state,
      motionEnabled(),
      animationMode.value === "teacher",
      showVisual,
    );
    animationControls.hidden = !showVisual;
    reference.hidden = animationMode.value !== "spelling" || !showVisual;
    const cue = cueAt(
      state.cues,
      teaching?.isExplaining() ? teaching.sourceTime() : state.seconds,
    );
    sourceLabel.textContent = state.sourceLabel || "AI CAPTIONS";
    hint.textContent = state.displayCues
        ? "Amharic translation · fluent review pending."
        : state.sourceLabel === "COURSE CAPTIONS"
          ? "English source captions."
          : "Generated from the video's audio. Review for accuracy.";
    note.textContent =
      animationMode.value === "spelling"
        ? "Experimental English fingerspelling preview · not EthSL translation or full ASL. Fluent review pending."
        : animationMode.value === "teacher"
          ? "Caption-timed visual gestures · not sign-language translation."
          : "Experimental gesture preview · illustrative movement, not EthSL translation.";
    motion.textContent = motionEnabled()
      ? "Pause animation"
      : "Enable animation";

    motionState.textContent = !state.cues.length
      ? "Waiting for captions"
      : !motionEnabled()
        ? "Animation paused · reduced motion or your preference"
        : teaching?.isReplaying()
          ? "Demonstration · video paused"
          : state.playing
            ? `Following video · ${state.rate}×`
            : state.playback === "loading"
              ? "Waiting for video controls"
              : state.playback === "not-loaded"
                ? "Load the video to begin"
                : "Paused with video";
    const text = generating
      ? "Transcribing the video…"
      : failure ||
        (state.displayCues
          ? cueAt(
              state.displayCues,
              teaching?.isExplaining() ? teaching.sourceTime() : state.seconds,
            )?.text
          : cue?.text) ||
        (state.cues.length
          ? "No speech at this moment."
          : "Generate captions to follow this lesson.");
    if (text !== lastText) {
      words.textContent = text;
      words.lang = state.displayCues ? state.language || "en" : "en";
      lastText = text;
    }
    stamp.textContent = `${String(Math.floor(state.seconds / 60)).padStart(2, "0")}:${String(Math.floor(state.seconds % 60)).padStart(2, "0")}`;
    generate.disabled = generating;
    generate.hidden = state.cues.length > 0 && !failure;
    draw();
    stop();
    if (
      !approved &&
      state.visible &&
      (state.playing || teaching?.isReplaying()) &&
      (!!cueAt(state.cues, state.seconds) || teaching?.isReplaying()) &&
      (animationMode.value !== "teacher" ||
        !teaching ||
        teaching.isOnscreen()) &&
      showVisual &&
      motionEnabled() &&
      typeof requestAnimationFrame === "function"
    )
      frame = requestAnimationFrame(animate);
  }
  select.onchange = refresh;
  animationMode.onchange = () => {
    refresh();
    if (animationMode.value === "spelling" && !spellingModule)
      void loadFeature<typeof Spelling>(
        new URL("/spelling.js", options.runtimeUrl || location.href).href,
        "MelaSpelling",
      )
        .then((value) => {
          spellingModule = value;
          if (!disposed) refresh();
        })
        .catch(() => {
          if (!disposed)
            description.textContent =
              "English fingerspelling is unavailable. Choose Visual teacher or retry.";
        });
  };
  motion.onclick = () => {
    motionOverride = !motionEnabled();
    refresh();
  };
  const motionChange = () => refresh();
  reduced?.addEventListener?.("change", motionChange);
  refresh();
  return {
    explain(seconds: number) {
      animationMode.value = "teacher";
      teaching?.explain(seconds);
      refresh();
    },
    setRenderer(value: RendererPreference) {
      teaching?.setRenderer(value);
    },
    update(next: PreviewState) {
      state = next;
      anchor = Date.now();
      refresh();
    },
    generating(value: boolean) {
      generating = value;
      if (value) failure = "";
      refresh();
    },
    error(message: string) {
      failure = message;
      refresh();
    },
    dispose() {
      disposed = true;
      teaching?.dispose();
      stop();
      reduced?.removeEventListener?.("change", motionChange);
      wrapper.remove();
    },
  };
}

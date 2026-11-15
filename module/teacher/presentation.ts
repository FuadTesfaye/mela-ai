import { loadTeacherRuntime } from "./runtime-loader";
import {
  gesturePhase,
  loadStoryboard,
  segmentAt,
  type Storyboard,
  type TeachingSegment,
} from "./storyboard";
import type {
  RendererPreference,
  TeacherFrame,
  TeacherRenderer,
} from "./types";
import type { PreviewState } from "../media/learning-preview";
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
export function mountTeacherPresentation(
  visual: HTMLElement,
  wrapper: HTMLElement,
  caption: HTMLElement,
  options: {
    runtimeUrl: string;
    storyboardUrl: string;
    renderer?: RendererPreference;
    changed: () => void;
    onResume?: (seconds: number) => boolean | void;
  },
) {
  const canvasHost = el("div", undefined, "teacher-canvas");
  canvasHost.hidden = true;
  visual.classList.add("teacher-surface");
  visual.prepend(canvasHost);
  const toolbar = el("div", undefined, "teacher-tools");
  const graphics = el("select");
  graphics.setAttribute("aria-label", "Teacher graphics");
  for (const [value, label] of [
    ["auto", "Adaptive 3D"],
    ["2d", "2D illustration"],
    ["3d", "Try 3D"],
  ]) {
    const o = el("option", label);
    o.value = value;
    graphics.append(o);
  }
  graphics.value = options.renderer || "auto";
  const status = el(
    "p",
    "3D loads when this panel opens.",
    "teacher-renderer-status",
  );
  status.setAttribute("role", "status");
  const cameras = el("div", undefined, "teacher-cameras");
  const front = el("button", "Front"),
    hands = el("button", "Hands focus"),
    reset = el("button", "Reset view");
  for (const b of [front, hands, reset]) b.type = "button";
  cameras.append(front, hands, reset);
  toolbar.append(graphics, cameras, status);
  wrapper.insertBefore(toolbar, caption);
  const card = el("section", undefined, "concept-card");
  card.setAttribute("aria-label", "Visual concept explanation");
  card.hidden = true;
  const title = el("h4"),
    diagram = el("ol", undefined, "concept-diagram"),
    explanation = el("p", undefined, "concept-explanation");
  const source = el("a", "View source", "concept-source");
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  const demo = el("div", undefined, "demonstration-controls");
  demo.hidden = true;
  const replay = el("button", "Replay demonstration"),
    resume = el("button", "Resume lesson");
  replay.type = resume.type = "button";
  const speed = el("select");
  speed.setAttribute("aria-label", "Demonstration speed");
  for (const value of [0.5, 0.75, 1]) {
    const o = el("option", `${value}× demo`);
    o.value = String(value);
    speed.append(o);
  }
  speed.value = ".75";
  // DOM implementations normalize .75 and 0.75 differently; use the option's exact value.
  speed.value = "0.75";
  const demoStatus = el(
    "p",
    "Video paused. Replay the demonstration to explore this concept.",
  );
  demoStatus.setAttribute("role", "status");
  demo.append(replay, speed, resume, demoStatus);
  card.append(title, diagram, explanation, source, demo);
  caption.append(card);
  let state: PreviewState = {
      cues: [],
      seconds: 0,
      rate: 1,
      playing: false,
      visible: false,
    },
    active = false,
    showVisual = true,
    motion = true,
    disposed = false,
    onscreen = true;
  let preference: RendererPreference = options.renderer || "auto",
    camera: TeacherFrame["camera"] = "front",
    runtime: TeacherRenderer | undefined,
    loading = false,
    failed = false,
    generation = 0;
  let storyboard: Storyboard | undefined,
    storyLoading = false,
    storyFailed = false,
    lastCard = "",
    lastPhase = 0;
  let explaining:
    | {
        at: number;
        videoId?: string;
        created: number;
        pauseSeen: boolean;
        elapsed: number;
        anchor: number;
        running: boolean;
        rate: number;
      }
    | undefined;
  const pageVisible = () => document.visibilityState !== "hidden";
  const visible = () =>
    state.visible && active && showVisual && onscreen && pageVisible();
  const notify = () => {
    if (!disposed) options.changed();
  };
  function setStatus(message: string, renderer: string) {
    if (status.textContent === message) return;
    status.textContent = message;
    visual.dataset.teacherRenderer = renderer;
    visual.dispatchEvent(
      new CustomEvent("mela:renderer-state", {
        bubbles: true,
        composed: true,
        detail: { renderer, status: message },
      }),
    );
  }
  function fallback(message: string) {
    runtime?.dispose();
    runtime = undefined;
    canvasHost.hidden = true;
    const svg = visual.querySelector("svg");
    if (svg) svg.style.display = "";
    failed = true;
    setStatus(message, "2d");
  }
  function ensure() {
    if (disposed || !visible()) return;
    if (!storyLoading && !storyFailed && !storyboard) {
      storyLoading = true;
      void loadStoryboard(options.storyboardUrl)
        .then((data) => {
          if (!disposed) {
            storyboard = data;
            lastCard = "";
            notify();
          }
        })
        .catch(() => {
          if (!disposed) {
            storyFailed = true;
            storyLoading = false;
          }
        });
    }
    if (preference === "2d") {
      setStatus("2D illustration selected.", "2d");
      return;
    }
    if (
      preference === "auto" &&
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData
    ) {
      setStatus(
        "2D illustration · data saving is enabled. Choose Try 3D to load graphics.",
        "2d",
      );
      return;
    }
    if (typeof WebGL2RenderingContext === "undefined") {
      fallback("2D illustration · WebGL 2 is unavailable.");
      return;
    }
    if (runtime || loading || failed) return;
    loading = true;
    const version = generation;
    setStatus("Loading the 3D teacher…", "loading");
    void loadTeacherRuntime(options.runtimeUrl)
      .then((factory) => {
        loading = false;
        if (disposed || version !== generation || !visible()) return;
        try {
          canvasHost.hidden = false;
          runtime = factory.mount(canvasHost, {
            onFailure: (message) => {
              if (!disposed) {
                fallback(message);
                notify();
              }
            },
          });
          canvasHost.hidden = false;
          const svg = visual.querySelector("svg");
          if (svg) svg.style.display = "none";
          runtime.resize();
          setStatus("3D visual teacher ready.", "3d");
          notify();
        } catch {
          fallback("2D illustration · 3D graphics could not start.");
          notify();
        }
      })
      .catch(() => {
        loading = false;
        if (!disposed && version === generation) {
          fallback(
            "2D illustration · 3D download failed. Choose Try 3D to retry.",
          );
          notify();
        }
      });
  }
  function frameAt(seconds: number): {
    frame: TeacherFrame;
    segment?: TeachingSegment;
  } {
    const sourceTime = explaining?.at ?? seconds;
    const segment = segmentAt(storyboard, state.videoId, sourceTime);
    let time = seconds,
      phase = segment ? gesturePhase(seconds, segment.start, segment.end) : 0.5;
    if (explaining) {
      const e = explaining;
      const elapsed = Math.min(
        4,
        e.elapsed + (e.running ? ((Date.now() - e.anchor) / 1000) * e.rate : 0),
      );
      phase = elapsed / 4;
      time = (segment?.start || e.at) + elapsed;
      if (elapsed >= 4 && e.running) {
        e.running = false;
        e.elapsed = 4;
        demoStatus.textContent =
          "Demonstration finished. The video remains paused.";
      }
    }
    const cue = state.cues.find(
      (c) => sourceTime >= c.start && sourceTime < c.end,
    );
    const gesture = segment?.gesture || (cue ? "emphasize" : "rest");
    return {
      segment,
      frame: {
        seconds: motion ? time : (segment?.start ?? cue?.start ?? 0),
        phase: motion ? phase : 0.5,
        gesture:
          segment?.gesture === "welcome" && time - segment.start > 3
            ? "rest"
            : gesture,
        playing: !!explaining?.running || (!explaining && state.playing),
        visible: visible(),
        motion,
        camera,
      },
    };
  }
  function showCard(segment: TeachingSegment | undefined, phase: number) {
    card.hidden = !segment && !explaining;
    const key = (segment?.id || "caption") + ":" + !!explaining;
    if (key !== lastCard) {
      lastCard = key;
      title.textContent = segment?.title || "From the current caption";
      explanation.hidden = !explaining;
      explanation.textContent =
        segment?.explanation ||
        "This video has no authored diagram yet. Read the source caption and ask MELA for a grounded explanation.";
      diagram.replaceChildren();
      diagram.hidden = !segment;
      diagram.dataset.kind = segment?.diagram.kind || "list";
      if (segment)
        for (const label of segment.diagram.labels)
          diagram.append(el("li", label));
      source.hidden = !state.videoId;
      source.href = `https://www.youtube.com/watch?v=${state.videoId}&t=${Math.floor(explaining?.at ?? segment?.start ?? 0)}`;
      source.textContent = `Source · ${Math.floor((explaining?.at ?? segment?.start ?? 0) / 60)}:${String(Math.floor((explaining?.at ?? segment?.start ?? 0) % 60)).padStart(2, "0")}`;
      demo.hidden = !explaining;
    }
    const index = Math.min(
      diagram.children.length - 1,
      Math.floor(phase * diagram.children.length),
    );
    Array.from(diagram.children).forEach((node, i) =>
      node.classList.toggle("active", i === index),
    );
  }
  function tick(seconds: number) {
    const data = frameAt(Number.isFinite(seconds) ? seconds : 0);
    lastPhase = data.frame.phase;
    runtime?.update(data.frame);
    showCard(data.segment, data.frame.phase);
    if (!active) card.hidden = true;
    return data;
  }
  function update(
    next: PreviewState,
    enabled: boolean,
    teacherMode: boolean,
    visualVisible = true,
  ) {
    if (disposed) return;
    if (explaining) {
      const e = explaining;
      if (!next.playing) e.pauseSeen = true;
      if (
        next.videoId !== e.videoId ||
        Math.abs(next.seconds - e.at) > 0.75 ||
        (next.playing && (e.pauseSeen || Date.now() - e.created > 1200))
      ) {
        explaining = undefined;
        lastCard = "";
      }
    }
    if (!teacherMode && explaining) {
      explaining = undefined;
      lastCard = "";
    }
    state = next;
    active = teacherMode;
    showVisual = visualVisible;
    motion = enabled;
    wrapper.dataset.explaining = String(!!explaining);
    toolbar.hidden = !active || !showVisual;
    card.hidden = !active;
    canvasHost.hidden = !active || !showVisual || !runtime;
    const svg = visual.querySelector("svg");
    if (svg) svg.style.display = active && runtime ? "none" : "";
    replay.disabled = !motion || !showVisual;
    if ((!motion || !visible()) && explaining?.running) {
      explaining.elapsed = Math.min(
        4,
        explaining.elapsed +
          ((Date.now() - explaining.anchor) / 1000) * explaining.rate,
      );
      explaining.running = false;
      demoStatus.textContent =
        "Animation is paused. Enable animation to replay the demonstration.";
    }
    ensure();
    for (const button of [front, hands, reset]) button.disabled = !runtime;
    tick(state.seconds);
    if (!active) card.hidden = true;
  }
  function setRenderer(value: RendererPreference) {
    preference = value;
    graphics.value = value;
    generation++;
    loading = false;
    failed = false;
    storyFailed = false;
    if (value === "2d") {
      runtime?.dispose();
      runtime = undefined;
      canvasHost.hidden = true;
      const svg = visual.querySelector("svg");
      if (svg) svg.style.display = "";
      setStatus("2D illustration selected.", "2d");
    }
    ensure();
    notify();
  }
  graphics.onchange = () => setRenderer(graphics.value as RendererPreference);
  for (const [button, value] of [
    [front, "front"],
    [hands, "hands"],
    [reset, "front"],
  ] as const)
    button.onclick = () => {
      camera = value;
      runtime?.resize();
      notify();
    };
  replay.onclick = () => {
    if (!explaining || !motion) return;
    explaining.elapsed = 0;
    explaining.anchor = Date.now();
    explaining.running = true;
    explaining.rate = Number(speed.value) || 0.75;
    demoStatus.textContent = "Demonstration playing · video paused.";
    notify();
  };
  speed.onchange = () => {
    if (!explaining) return;
    explaining.elapsed = Math.min(
      4,
      explaining.elapsed +
        (explaining.running
          ? ((Date.now() - explaining.anchor) / 1000) * explaining.rate
          : 0),
    );
    explaining.anchor = Date.now();
    explaining.rate = Number(speed.value) || 0.75;
    notify();
  };
  resume.onclick = () => {
    if (!explaining) return;
    const at = explaining.at;
    if (options.onResume?.(at) === false) {
      demoStatus.textContent = "Load the video before resuming the lesson.";
      return;
    }
    explaining = undefined;
    lastCard = "";
    notify();
  };
  const observer =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          onscreen = entries[0]?.isIntersecting ?? true;
          notify();
        })
      : undefined;
  observer?.observe(visual);
  const visibility = () => notify();
  document.addEventListener("visibilitychange", visibility);
  return {
    update,
    tick,
    setRenderer,
    isReplaying: () => !!explaining?.running,
    isOnscreen: () => onscreen && pageVisible(),
    isExplaining: () => !!explaining,
    explain(seconds: number) {
      if (disposed) return;
      explaining = {
        at: seconds,
        videoId: state.videoId,
        created: Date.now(),
        pauseSeen: !state.playing,
        elapsed: 2,
        anchor: Date.now(),
        running: false,
        rate: Number(speed.value) || 0.75,
      };
      lastCard = "";
      demoStatus.textContent =
        "Video paused. Replay the demonstration to explore this concept.";
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      runtime?.dispose();
      runtime = undefined;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvasHost.remove();
      toolbar.remove();
      card.remove();
    },
    sourceTime: () => explaining?.at ?? state.seconds,
    phase: () => lastPhase,
  };
}

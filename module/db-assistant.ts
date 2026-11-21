import { speechLocales, languageOrEnglish } from "../lib/languages";
import { loadFeature } from "./localization/runtime";
import { renderExplanationBlocks } from "./components-explanations";
import {
  initialLanguage,
  setLanguage,
  enhanceLanguage,
} from "./localization/language";
import { styles } from "./styles";
import { strings } from "./i18n/strings";
import { videoEvidence, type VideoCue } from "../lib/media/video-context";
import type {
  Answer,
  Section,
  Language,
  LearningContext,
  VideoSnapshot,
  ExplanationMode,
} from "../lib/types";
import { detectContext } from "./context/savanna-adapter";
import { observeContext } from "./context/context-observer";
import {
  loadKnowledge,
  offlineAnswer,
  setAmEvidence,
} from "./knowledge/offline-search";
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
class DBAssistant extends HTMLElement {
  private root!: ShadowRoot;
  private _melaOwnKnowledge: Section[] = [];
  private _melaActions?: { open(): void; destroy(): void };
  contextRoot?: HTMLElement;
  private _melaReadContext() {
    const context = detectContext(
      this._melaIncludePublicPage,
      this.contextRoot,
    );
    context.sections = context.sections.filter(
      (s) => !s.id.startsWith("video-"),
    );
    return context;
  }
  private video?: VideoSnapshot;
  private _melaExplanationMode: ExplanationMode = "auto";
  private visual?: HTMLInputElement;
  private videoCues: VideoCue[] = [];
  private scope: "lesson" | "wholeVideo" | "moment" = "lesson";
  private _melaScopeChosen = false;
  useLessonContext() {
    this.scope = "lesson";
    this._melaScopeChosen = true;
    this._melaUpdateVideoLabel();
  }
  private mediaSource(event: Event) {
    if (
      !(event.target instanceof HTMLElement) ||
      event.target.tagName !== "MELA-COURSE-MEDIA"
    )
      return false;
    const scope = this.closest("[data-mela-sdk-root]");
    const source = event.target.closest("[data-mela-sdk-root]");
    if (scope !== source) return false;
    return !!event.target.closest("main,article,[data-mela-context]");
  }
  private readVideo(value: unknown): VideoSnapshot | undefined {
    if (!value || typeof value !== "object") return;
    const v = value as VideoSnapshot;
    try {
      const url = new URL(v.url);
      if (
        url.origin !== "https://www.youtube.com" ||
        url.searchParams.get("v") !== v.videoId ||
        !/^[-_a-zA-Z0-9]{11}$/.test(v.videoId) ||
        !Number.isFinite(v.currentTime) ||
        v.currentTime < 0 ||
        v.currentTime > 14400
      )
        return;
      return {
        ...v,
        title: String(v.title || "Video").slice(0, 200),
        duration: Math.min(14400, Math.max(0, Number(v.duration) || 0)),
      };
    } catch {
      return;
    }
  }
  private videoEvent = (event: Event) => {
    if (!this.mediaSource(event)) return;
    const value = this.readVideo((event as CustomEvent).detail);
    if (!value) return;
    const changed = this.video?.videoId !== value.videoId;
    if (changed) {
      this.videoCues = [];
      if (this.scope !== "lesson") {
        this.version++;
        this.abort?.abort();
      }
      this.scope = "lesson";
    }
    this.video = value;
    this._melaUpdateVideoLabel();
  };
  private transcriptEvent = (event: Event) => {
    if (!this.mediaSource(event)) return;
    const detail = (event as CustomEvent).detail;
    const value = this.readVideo(detail?.video);
    if (!value || !Array.isArray(detail.cues) || detail.cues.length > 240)
      return;
    const valid = detail.cues.every(
      (c: VideoCue) =>
        typeof c.text === "string" &&
        c.text.length <= 1500 &&
        Number.isFinite(c.start) &&
        Number.isFinite(c.end) &&
        c.start >= 0 &&
        c.end > c.start,
    );
    if (!valid) return;
    if (this.video?.transcriptRevision !== value.transcriptRevision) {
      this.version++;
      this.abort?.abort();
    }
    if (
      !this._melaScopeChosen &&
      this.context.sections.length < 2 &&
      detail.cues.length &&
      (!this.videoCues.length ||
        !this.video ||
        this.video.videoId !== value.videoId)
    )
      this.scope = "wholeVideo";
    this.video = value;
    this.videoCues = detail.cues;
    this.context = this._melaReadContext();
    this._melaUpdateVideoLabel();
  };
  private momentEvent = (event: Event) => {
    if (!this.mediaSource(event)) return;
    if (this.busy) {
      this._melaSetStatus(
        "Please wait for the current explanation, then try this moment again.",
      );
      return;
    }
    const detail = (event as CustomEvent).detail;
    const value = this.readVideo(detail?.video);
    if (!value) return;
    this.video = value;
    this.scope = "moment";
    this._melaUpdateVideoLabel();
    this.open();
    this.input.value = "Explain this moment in the video.";
    void this.ask();
  };
  private _melaUpdateVideoLabel() {
    const target = this.root?.querySelector(".video-time");
    if (target)
      target.textContent = this.video
        ? `Video · ${Math.floor(this.video.currentTime / 60)}:${String(Math.floor(this.video.currentTime % 60)).padStart(2, "0")}`
        : "Lesson context";
    const select =
      this.root?.querySelector<HTMLSelectElement>(".context-scope");
    if (select) select.value = this.scope;
  }

  private locale: Language = "en";
  private opened = false;
  private _melaReadingMode = false;
  private busy = false;
  private version = 0;
  private _melaIncludePublicPage = false;
  private context: LearningContext = { pageType: "unknown", sections: [] };
  private _melaKnowledgeReady?: Promise<unknown>;
  private _melaStopObserving?: () => void;
  private abort?: AbortController;
  private _melaTicketTimer?: ReturnType<typeof setInterval>;
  private ticket?: { id: string; token: string };
  private _melaLastReply = 0;
  private history: {
    role: string;
    content: string;
    answer?: Answer;
    question?: string;
    artifactKey?: string;
    language?: Language;
  }[] = [];
  private _melaMessages!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private launcher!: HTMLButtonElement;
  private input!: HTMLTextAreaElement;
  private status!: HTMLDivElement;
  private cloud!: HTMLInputElement;
  private _melaLastQuestion = "";
  private _melaRecognition?: { stop: () => void; toggle: () => void };
  private _melaScreenStop?: () => void;
  // Voice access (screen readers, Ctrl+Shift+M, PWA "Talk" shortcut): see module/voice-access.ts.
  private _melaVoiceMode = false;
  private _melaRecAuto = false;
  private _melaMic?: HTMLButtonElement;
  private talkEvent = () => {
    this.open();
    if (this._melaMic) this.microphone(this._melaMic);
  };
  private voiceModeEvent = (e: Event) => {
    const mode = (e as CustomEvent).detail;
    this._melaVoiceMode = !!mode;
    // Screen-reader users hear answers through their screen reader (live region).
    this._melaSpeak = mode !== "screen-reader";
  };
  private _melaSpeak = true;
  private openEvent = (e: Event) => {
    this.open();
    const q = (e as CustomEvent).detail?.question;
    if (q) {
      if (/person/.test(q)) this.help();
      else {
        this.input.value = q;
        this.input.focus();
      }
    }
  };
  private get t() {
    return strings[this.locale];
  }
  private get api() {
    return (this.getAttribute("api") || "/api").replace(/\/$/, "") + "/v1";
  }
  connectedCallback() {
    if (this.root) return;
    this.locale = initialLanguage(this);
    this.setAttribute("lang", this.locale);
    this.opened = this.hasAttribute("open");
    try {
      this._melaReadingMode = localStorage.getItem("mela-reading-mode") === "1";
    } catch {}
    this.root = this.attachShadow({ mode: "open" });
    this.context = this._melaReadContext();
    this.render();
    if (this.locale === "am") void enhanceLanguage(this).catch(() => {});
    this._melaStopObserving = observeContext(
      (context) => {
        if (JSON.stringify(context) === JSON.stringify(this.context)) return;
        this.context = context;
        this.version++;
        this.abort?.abort();
        this.updateContext();
        this._melaSetStatus(this.t.contextChanged);
      },
      () => this._melaReadContext(),
    );
    window.addEventListener("mela:open", this.openEvent);
    window.addEventListener("mela:talk", this.talkEvent);
    window.addEventListener("mela:voice-mode", this.voiceModeEvent);
    void loadFeature(
      new URL("/voice-access.js", new URL(this.api, location.href)).href,
      "MelaVoiceAccess",
    ).catch(() => {});
    document.addEventListener("mela:video-state", this.videoEvent);
    document.addEventListener("mela:transcript-ready", this.transcriptEvent);
    document.addEventListener("mela:explain-moment", this.momentEvent);
    this._melaKnowledgeReady = loadKnowledge(
      this.getAttribute("content") || "/content.json",
    )
      .then((sections) => {
        this._melaOwnKnowledge = sections;
      })
      .catch(() => {});
  }
  static get observedAttributes() {
    return ["lang"];
  }
  attributeChangedCallback(
    name: string,
    old: string | null,
    value: string | null,
  ) {
    if (!this.root || old === value) return;
    const next = languageOrEnglish(value);
    if (next === this.locale) return;
    const draft = this.input.value;
    const optionsOpen = this.root
      .querySelector(".options")
      ?.hasAttribute("open");
    const inside = this.root.activeElement;
    const outside = document.activeElement as HTMLElement | null;
    this.abort?.abort();
    this.version++;
    this.busy = false;
    this._melaRecognition?.stop();
    this._melaRecognition = undefined;
    this.locale = next;
    this.render();
    this.input.value = draft;
    if (optionsOpen)
      this.root.querySelector(".options")?.setAttribute("open", "");
    if (inside?.tagName === "SELECT")
      this.root
        .querySelector<HTMLSelectElement>('select[aria-label="Language / ቋንቋ"]')
        ?.focus();
    else if (!inside && outside !== this)
      outside?.focus?.({ preventScroll: true });
    if (next === "am")
      void enhanceLanguage(this).catch(() =>
        this._melaSetStatus(this.t.failed),
      );
  }
  getLearningContext() {
    return this._melaReadContext();
  }
  installEvidence(
    entries: import("../lib/localization/shared").PreparedEntry[],
    glossary: Record<string, string[]>,
  ) {
    setAmEvidence(entries, glossary);
  }
  installTranslations(values: Record<string, string>) {
    for (const key of Object.keys(strings.en) as (keyof typeof strings.en)[])
      if (values[strings.en[key]]) strings.am[key] = values[strings.en[key]];
  }
  disconnectedCallback() {
    this._melaActions?.destroy();
    this._melaStopObserving?.();
    window.removeEventListener("mela:open", this.openEvent);
    window.removeEventListener("mela:talk", this.talkEvent);
    window.removeEventListener("mela:voice-mode", this.voiceModeEvent);
    document.removeEventListener("mela:video-state", this.videoEvent);
    document.removeEventListener("mela:transcript-ready", this.transcriptEvent);
    document.removeEventListener("mela:explain-moment", this.momentEvent);
    this.abort?.abort();
    clearInterval(this._melaTicketTimer);
    this._melaRecognition?.stop();
    this._melaScreenStop?.();
    window.speechSynthesis?.cancel();
  }
  private render() {
    this.root.replaceChildren();
    const style = el("style");
    style.textContent = styles;
    this.root.append(style);
    this.launcher = el("button", undefined, "launcher");
    this.launcher.append(el("span", "✦"), document.createTextNode(this.t.open));
    this.launcher.setAttribute("aria-label", this.t.open);
    this.launcher.setAttribute("aria-expanded", String(this.opened));
    this.launcher.setAttribute("aria-controls", "mela-panel");
    this.launcher.onclick = () => this.open();
    this.panel = el("div", undefined, "panel hidden");
    this.panel.id = "mela-panel";
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", this.t.title);
    this.panel.lang = this.locale;
    this.panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.close();
        e.preventDefault();
      }
    });
    const header = el("div", undefined, "header");
    const mark = el("span", "✦", "mark");
    mark.setAttribute("aria-hidden", "true");
    header.append(mark);
    const name = el("div");
    name.append(el("strong", "mela AI"), el("small", this.t.title));
    const close = el("button", "×");
    close.setAttribute("aria-label", this.t.close);
    close.onclick = () => this.close();
    header.append(name, close);
    const toolbar = el("div", undefined, "toolbar");
    const language = el("select");
    language.setAttribute("aria-label", "Language / ቋንቋ");
    for (const [value, label] of [
      ["en", "English"],
      ["am", "አማርኛ"],
      ["om", "Afaan Oromo · source text"],
      ["ti", "ትግርኛ · source text"],
    ]) {
      const option = el("option", label);
      option.value = value;
      language.append(option);
    }
    language.value = this.locale;
    language.onchange = () =>
      setLanguage(this, language.value as Language, true);
    toolbar.append(language, el("span", undefined, "context"));
    const scope = el(
      "button",
      this.locale === "am" ? "የገጽ መረጃ" : "Page context",
    );
    scope.title =
      "Use public text from this open page. Other tabs and private form fields are not read.";
    scope.setAttribute("aria-pressed", String(this._melaIncludePublicPage));
    scope.onclick = () => {
      if (
        !this._melaIncludePublicPage &&
        !window.confirm(
          this.locale === "am"
            ? "የዚህን ገጽ ሕዝባዊ ጽሑፍ ለጥያቄዎ መረጃ ለመጠቀም ይፈቅዳሉ?"
            : "Use the public text on this page as context for your questions? Private forms, account fields, and other tabs are excluded. Cloud AI still requires the separate sharing choice.",
        )
      )
        return;
      this._melaIncludePublicPage = !this._melaIncludePublicPage;
      this.context = this._melaReadContext();
      this.version++;
      this.abort?.abort();
      scope.setAttribute("aria-pressed", String(this._melaIncludePublicPage));
      this.updateContext();
      this._melaSetStatus(this.t.contextChanged);
    };
    const reading = el("button", this.t.readingMode);
    reading.type = "button";
    reading.setAttribute("aria-pressed", String(this._melaReadingMode));
    reading.onclick = () => {
      this._melaReadingMode = !this._melaReadingMode;
      reading.setAttribute("aria-pressed", String(this._melaReadingMode));
      try {
        localStorage.setItem(
          "mela-reading-mode",
          this._melaReadingMode ? "1" : "0",
        );
      } catch {}
      this.applyReadingMode();
      this._melaSetStatus(
        this._melaReadingMode ? this.t.readingOn : this.t.readingOff,
      );
    };
    toolbar.append(reading);
    const options = el("details", undefined, "options");
    options.append(el("summary", this.t.options), scope);
    const library = el("a", "Download public courses");
    library.href = new URL(
      "/offline.html",
      new URL(this.api, location.href),
    ).href;
    options.append(library);
    const sizeLabel = el("label", "Answer text size");
    const size = el("select");
    size.setAttribute("aria-label", "Answer text size");
    for (const [value, label] of [
      ["14", "Standard"],
      ["18", "Large"],
      ["22", "Extra large"],
    ]) {
      const option = el("option", label);
      option.value = value;
      size.append(option);
    }
    try {
      size.value = localStorage.getItem("mela-answer-size") || "14";
    } catch {
      size.value = "14";
    }
    const applySize = () => {
      const value = ["14", "18", "22"].includes(size.value) ? size.value : "14";
      this.style.setProperty("--mela-answer-size", value + "px");
      try {
        localStorage.setItem("mela-answer-size", value);
      } catch {}
    };
    applySize();
    size.onchange = applySize;
    sizeLabel.append(size);
    options.append(sizeLabel);
    const actions = el("button", "Use web voice commands");
    actions.type = "button";
    actions.onclick = async () => {
      try {
        const feature = await loadFeature<{
          mountActions: (options: { root?: ParentNode; api: string }) => {
            open(): void;
            destroy(): void;
          };
        }>(
          new URL("/actions.js", new URL(this.api, location.href)).href,
          "MelaActions",
        );
        this._melaActions?.destroy();
        this._melaActions = feature.mountActions({
          root: this.contextRoot,
          api: this.api,
        });
        this._melaActions.open();
      } catch {
        this._melaSetStatus(
          "Web voice commands are unavailable. Please retry.",
        );
      }
    };
    options.append(actions);
    this._melaMessages = el("div", undefined, "messages");
    this._melaMessages.setAttribute("role", "log");
    this._melaMessages.setAttribute("aria-label", this.t.title);
    this._melaMessages.setAttribute("aria-live", "polite");
    this._melaMessages.setAttribute("aria-relevant", "additions");
    this._melaMessages.setAttribute("aria-atomic", "false");
    this._melaMessages.setAttribute("tabindex", "0");
    this.status = el("div", undefined, "status");
    this.status.setAttribute("role", "status");
    const composer = el("form", undefined, "composer");
    const row = el("div", undefined, "input-row");
    this.input = el("textarea");
    this.input.rows = 2;
    this.input.maxLength = 2000;
    this.input.placeholder = this.t.placeholder;
    this.input.setAttribute("aria-label", this.t.placeholder);
    this.input.dir = "auto";
    this.input.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void this.ask();
      }
    };
    const send = el("button", "↑", "send");
    send.type = "submit";
    send.setAttribute("aria-label", this.t.send);
    row.append(this.input, send);
    const privacy = el("label", undefined, "privacy");
    this.cloud = el("input");
    this.cloud.type = "checkbox";
    // AI answers are on by default (presentation/MVP); hosts can opt out with ai="off".
    this.cloud.checked = this.getAttribute("ai") !== "off";
    privacy.append(this.cloud, document.createTextNode(this.t.privacy));
    const footer = el("div", undefined, "footer");
    const help = el("button", this.t.help);
    help.type = "button";
    help.onclick = () => this.help();
    const mic = el("button", this.t.mic);
    mic.type = "button";
    mic.setAttribute("aria-label", this.t.mic);
    mic.onclick = () => this.microphone(mic);
    this._melaMic = mic;
    footer.append(help, mic);
    composer.append(row, privacy, footer);
    composer.onsubmit = (e) => {
      e.preventDefault();
      void this.ask();
    };
    const learning = el("div", undefined, "learning-controls");
    const select = el("select", undefined, "context-scope");
    select.setAttribute("aria-label", "Question context");
    for (const [value, label] of [
      ["lesson", "Lesson"],
      ["wholeVideo", "Whole video"],
      ["moment", "This moment"],
    ]) {
      const option = el("option", label);
      option.value = value;
      select.append(option);
    }
    select.value = this.scope;
    select.onchange = () => {
      this.scope = select.value as typeof this.scope;
      this._melaScopeChosen = true;
    };
    learning.append(select, el("span", undefined, "video-time"));
    const mode = el("select");
    mode.setAttribute("aria-label", "Explanation format");
    for (const [value, label] of [
      ["auto", "Explain clearly"],
      ["simple", "Simplify"],
      ["example", "Example"],
      ["steps", "Step by step"],
      ["diagram", "Diagram"],
    ]) {
      const option = el("option", label);
      option.value = value;
      mode.append(option);
    }
    mode.value = this._melaExplanationMode;
    mode.onchange = () => {
      this._melaExplanationMode = mode.value as ExplanationMode;
    };
    learning.append(mode);
    const visualLabel = el("label");
    this.visual = el("input");
    this.visual.type = "checkbox";
    this.visual.disabled = true;
    visualLabel.append(
      this.visual,
      document.createTextNode("Include on-screen visuals (Gemini)"),
    );
    learning.append(visualLabel);
    const saved = el("button", "Saved explanations");
    saved.type = "button";
    saved.onclick = () => {
      const dialog = el("dialog");
      const close = el("button", "Close saved explanations");
      close.type = "button";
      close.onclick = () => dialog.close();
      dialog.append(el("h3", "Saved on this device"), close);
      let count = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.startsWith("mela-explanation:")) continue;
          const answer = JSON.parse(
            localStorage.getItem(key) || "null",
          ) as Answer;
          if (
            !answer ||
            typeof answer.answer !== "string" ||
            !Array.isArray(answer.citations)
          )
            continue;
          count++;
          const show = el(
            "button",
            (answer.summary || answer.answer).slice(0, 110),
          );
          show.type = "button";
          show.onclick = () => {
            this._melaMessage("assistant", answer.answer, false, answer);
            dialog.close();
          };
          dialog.append(show);
        }
      } catch {
        dialog.append(el("p", "Browser storage is unavailable."));
      }
      if (!count)
        dialog.append(el("p", "Save an answer to read it here offline."));
      const clear = el("button", "Remove saved explanations");
      clear.type = "button";
      clear.onclick = () => {
        try {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("mela-explanation:")) keys.push(key);
          }
          for (const key of keys) localStorage.removeItem(key);
        } catch {}
        dialog.close();
      };
      dialog.append(clear);
      dialog.addEventListener(
        "close",
        () => {
          dialog.remove();
          saved.focus();
        },
        { once: true },
      );
      this.root.append(dialog);
      dialog.showModal();
      close.focus();
    };
    learning.append(saved);
    this.cloud.onchange = () => {
      if (this.visual) {
        this.visual.disabled = !this.cloud.checked;
        if (!this.cloud.checked) this.visual.checked = false;
      }
    };
    if (this.visual) this.visual.disabled = !this.cloud.checked;
    const reader = el(
      "button",
      this.locale === "am" ? "ትምህርቱን በአማርኛ ያንብቡ" : "Read lesson in Amharic",
    );
    reader.type = "button";
    reader.onclick = () =>
      void enhanceLanguage(this)
        .then(() => this.dispatchEvent(new CustomEvent("mela:read-lesson")))
        .catch(() => this._melaSetStatus(this.t.failed));
    options.append(reader, learning);
    this.panel.append(
      header,
      toolbar,
      options,
      this._melaMessages,
      this.status,
      composer,
    );
    this.root.append(this.launcher, this.panel);
    this._melaMessage("assistant", this.t.welcome, false);
    for (const message of this.history)
      this._melaMessage(
        message.role,
        message.content,
        false,
        message.answer,
        message.question,
        message.artifactKey,
        message.language,
      );
    this.updateContext();
    this._melaUpdateVideoLabel();
    this.applyReadingMode();
    if (this.opened) this.open();
    if (this.ticket) this._melaShowTicket();
  }
  private open() {
    this.opened = true;
    this.panel.classList.remove("hidden");
    this.launcher.classList.add("hidden");
    this.launcher.setAttribute("aria-expanded", "true");
    this.input.focus();
  }
  private close() {
    this._melaRecognition?.stop();
    this._melaRecognition = undefined;
    this.opened = false;
    this.panel.classList.add("hidden");
    this.launcher.classList.remove("hidden");
    this.launcher.setAttribute("aria-expanded", "false");
    this.launcher.focus();
  }
  private updateContext() {
    const target = this.root.querySelector(".context");
    if (target) {
      target.textContent =
        this.context.lessonTitle ||
        this.context.moduleTitle ||
        this.context.courseTitle ||
        this.t.unknown;
      target.setAttribute("title", target.textContent);
    }
  }
  private _melaSetStatus(text: string, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle("error", error);
  }
  private _melaMessage(
    role: string,
    text: string,
    save = true,
    answer?: Answer,
    question = this._melaLastQuestion,
    artifactKey?: string,
    messageLanguage = answer?.language || this.locale,
  ) {
    if (save) {
      this.history.push({
        role,
        content: text.slice(0, 12000),
        answer,
        question,
        artifactKey,
        language: messageLanguage,
      });
      this.history = this.history.slice(-100);
    }
    const node = el(
      "div",
      undefined,
      "message" + (role === "user" ? " user" : ""),
    );
    node.dir = "auto";
    node.lang = messageLanguage;
    node.append(
      el(
        "span",
        role === "user"
          ? this.locale === "am"
            ? "እርስዎ"
            : "You"
          : role === "tutor"
            ? this.locale === "am"
              ? "አስተማሪ"
              : "Tutor"
            : "Mela",
        "role",
      ),
      el("p", answer?.summary || text),
    );
    if (answer) {
      const generated = ["gemini", "cloud", "local"].includes(answer.provider);
      const mode = el(
        "small",
        generated
          ? "AI explanation · check the lesson sources"
          : "Source-only answer · no language model used",
        "answer-mode",
      );
      mode.lang = "en";
      node.append(mode);
    }
    if (answer?.blocks?.length) renderExplanationBlocks(answer.blocks, node);
    if (answer?.citations.length) {
      const sources = el("ul", undefined, "sources");
      for (const c of answer.citations) {
        try {
          const url = new URL(c.url, location.href);
          if (!["http:", "https:"].includes(url.protocol)) continue;
          const a = el("a", c.title);
          a.href = url.href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          const li = el("li");
          li.append(a);
          sources.append(li);
        } catch {}
      }
      node.append(sources);
    }
    if (role !== "user") {
      const actions = el("div", undefined, "message-actions");
      const listen = el("button", this.t.listen);
      listen.onclick = () => this._melaListen(text, messageLanguage);
      const stop = el("button", this.t.stop);
      stop.onclick = () => window.speechSynthesis?.cancel();
      actions.append(listen, stop);
      if (answer?.matched) {
        const simplify = el("button", this.t.simple);
        const sourceQuestion = question;
        simplify.onclick = () => {
          this.input.value = sourceQuestion;
          void this.ask(true);
        };
        actions.append(simplify);
      }
      if (answer?.matched && artifactKey) {
        const save = el("button", "Save explanation offline");
        save.type = "button";
        save.onclick = () => {
          try {
            let keys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key?.startsWith("mela-explanation:")) keys.push(key);
            }
            if (keys.length >= 20) localStorage.removeItem(keys[0]);
            localStorage.setItem(
              "mela-explanation:" + artifactKey,
              JSON.stringify(answer),
            );
            this._melaSetStatus(
              "Explanation saved on this device. Clear browser site data to remove it.",
            );
            save.textContent = "Saved offline";
          } catch {
            this._melaSetStatus("Browser storage is unavailable.");
          }
        };
        actions.append(save);
      }
      node.append(actions);
    }
    this._melaMessages.append(node);
    this.applyReadingMode();
    this._melaMessages.scrollTop = this._melaMessages.scrollHeight;
  }
  private async ask(simple = false) {
    const said = this.input.value.trim();
    if (!said || this.busy) return;
    // Voice navigation (module/voice-access.ts) may handle or rewrite a command.
    const heard = new CustomEvent("mela:heard", {
      cancelable: true,
      detail: {
        text: said,
        reply: (t: string) =>
          setTimeout(() => this._melaMessage("assistant", t, false)),
      },
    });
    if (!window.dispatchEvent(heard)) {
      this.input.value = "";
      this._melaMessage("user", said, false);
      return;
    }
    const question = heard.detail.text;
    if (this.locale === "am")
      try {
        await enhanceLanguage(this);
      } catch {}
    if (this.busy) return;
    this._melaLastQuestion = question;
    if (
      /^(i.d like to talk to a person|human help|የሰው እርዳታ)$/i.test(question)
    ) {
      this.help();
      return;
    }
    const questionScope =
      this.scope === "lesson" &&
      !this._melaScopeChosen &&
      this.videoCues.length &&
      /\b(video|transcript)\b|ቪዲዮ/i.test(question)
        ? "wholeVideo"
        : this.scope;
    const snapshot = videoEvidence(
      { ...this.context, video: this.video ? { ...this.video } : undefined },
      this.videoCues,
      questionScope,
    );
    const allowVisual =
      questionScope === "moment" &&
      !!this.visual?.checked &&
      this.cloud.checked &&
      !!snapshot.video;
    if (
      questionScope !== "lesson" &&
      !snapshot.sections.length &&
      !allowVisual
    ) {
      this._melaSetStatus(
        "Generate or restore this video's English transcript first.",
      );
      return;
    }
    const mode = simple ? "simple" : this._melaExplanationMode;
    this.busy = true;
    this._melaMessages.setAttribute("aria-busy", "true");
    const version = this.version;
    let artifactKey: string | undefined;
    try {
      if (window.crypto?.subtle) {
        const bytes = new TextEncoder().encode(
          JSON.stringify({
            question,
            mode,
            scope: questionScope,
            language: this.locale,
            visual: allowVisual,
            course: snapshot.courseId,
            video: snapshot.video
              ? {
                  id: snapshot.video.videoId,
                  time:
                    questionScope === "moment"
                      ? Math.floor(snapshot.video.currentTime / 5)
                      : 0,
                  revision: snapshot.video.transcriptRevision,
                }
              : undefined,
            sections: snapshot.sections,
          }),
        );
        const digest = await window.crypto.subtle.digest("SHA-256", bytes);
        artifactKey = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch {}
    if (version !== this.version) {
      this.busy = false;
      this._melaMessages.setAttribute("aria-busy", "false");
      return;
    }
    this.input.value = "";
    this._melaMessage("user", said);
    this.dispatchEvent(
      new CustomEvent("db-assistant:question", {
        bubbles: true,
        composed: true,
        detail: { language: this.locale },
      }),
    );
    this.abort = new AbortController();
    this._melaSetStatus(this.t.thinking);
    const timeout = setTimeout(
      () => this.abort?.abort(),
      allowVisual ? 65000 : 30000,
    );
    try {
      let answer: Answer;
      try {
        if (!navigator.onLine || !this.cloud.checked) throw new Error("local");
        const response = await fetch(this.api + "/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            language: this.locale,
            context: snapshot,
            scope: questionScope,
            cloudConsent: this.cloud.checked,
            simple,
            explanationMode: mode,
            includeVisualContext: allowVisual,
          }),
          signal: this.abort.signal,
        });
        if (!response.ok) throw new Error("service");
        answer = await response.json();
        this._melaSetStatus(answer.notice || this.t.ready);
      } catch {
        if (version !== this.version) return;
        await this._melaKnowledgeReady;
        answer = await offlineAnswer(
          question,
          this.locale,
          snapshot,
          simple,
          this._melaOwnKnowledge,
        );
        this._melaSetStatus(
          navigator.onLine ? answer.notice || this.t.ready : this.t.offline,
        );
      }
      if (version === this.version) {
        this._melaMessage(
          "assistant",
          answer.answer,
          true,
          answer,
          question,
          artifactKey,
        );
        window.dispatchEvent(
          new CustomEvent("mela:answer", { detail: answer.answer }),
        );
        if (this._melaVoiceMode && this._melaSpeak)
          this._melaListen(answer.answer);
      }
    } catch {
      this._melaSetStatus(this.t.failed, true);
    } finally {
      clearTimeout(timeout);
      this.busy = false;
      this._melaMessages.setAttribute("aria-busy", "false");
    }
  }
  private _melaListen(text: string, language = this.locale) {
    if (!window.speechSynthesis) {
      this._melaSetStatus(this.t.noVoice);
      return;
    }
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(language));
    // English can use the device's default voice; other languages need a match.
    if (!voice && language !== "en") {
      this._melaSetStatus(this.t.noVoice);
      return;
    }
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = speechLocales[language];
    if (voice) speech.voice = voice;
    speech.rate = 0.9;
    speechSynthesis.speak(speech);
  }
  private microphone(button: HTMLButtonElement) {
    if (this._melaRecognition && this._melaRecAuto === this._melaVoiceMode) {
      this._melaRecognition.toggle();
      return;
    }
    this._melaRecognition?.stop();
    this._melaRecAuto = this._melaVoiceMode;
    button.disabled = true;
    void loadFeature<{
      create: (options: {
        input: HTMLTextAreaElement;
        button: HTMLButtonElement;
        language: () => Language;
        status: (message: string, error?: boolean) => void;
        api: string;
        autoMode?: boolean;
        onFinal?: () => void;
      }) => { stop: () => void; toggle: () => void };
    }>(new URL("/voice.js", new URL(this.api, location.href)).href, "MelaVoice")
      .then((feature) => {
        if (!button.isConnected) return;
        button.disabled = false;
        this._melaRecognition = feature.create({
          input: this.input,
          button,
          language: () => this.locale,
          status: (message, error) => this._melaSetStatus(message, error),
          api: this.api,
          autoMode: this._melaVoiceMode,
          onFinal: () => this._melaVoiceMode && void this.ask(),
        });
        this._melaRecognition.toggle();
      })
      .catch(() => {
        button.disabled = false;
        this._melaSetStatus(this.t.noMic, true);
      });
  }
  private help() {
    if (this.root.querySelector(".help-view")) return;
    const view = el("div", undefined, "help-view");
    view.append(el("h3", this.t.help), el("p", this.t.helpIntro));
    const choices: { input: HTMLInputElement; key: string }[] = [];
    for (const [key, label] of [
      ["chat", this.t.shareChat],
      ["context", this.t.shareContext],
      ["consent", this.t.consent],
    ]) {
      const row = el("label");
      const input = el("input");
      input.type = "checkbox";
      row.append(input, document.createTextNode(label));
      choices.push({ input, key });
      view.append(row);
    }
    const preview = el("pre");
    preview.textContent =
      this.locale === "am" ? "ምንም አልተመረጠም" : "No information selected.";
    const update = () => {
      preview.textContent = JSON.stringify(
        {
          conversation: choices[0].input.checked
            ? this.history.map(({ role, content }) => ({ role, content }))
            : [],
          context: choices[1].input.checked ? this.context : undefined,
        },
        null,
        2,
      );
    };
    choices.forEach((c) => (c.input.onchange = update));
    view.append(preview);
    const uploadLabel = el("label", this.t.screenshot);
    const upload = el("input");
    upload.type = "file";
    upload.accept = "image/png,image/jpeg,image/webp";
    uploadLabel.append(upload);
    view.append(uploadLabel);
    const status = el("p");
    status.setAttribute("role", "status");
    const confirm = el("button", this.t.confirm, "send");
    const cancel = el("button", this.t.cancel);
    cancel.onclick = () => {
      view.remove();
      this._melaMessages.classList.remove("hidden");
      this.root.querySelector(".composer")?.classList.remove("hidden");
      this.input.focus();
    };
    confirm.onclick = async () => {
      if (!choices[2].input.checked) {
        status.textContent = this.t.consent;
        return;
      }
      confirm.disabled = true;
      try {
        let screenshot: string | undefined;
        const file = upload.files?.[0];
        if (file) {
          if (
            file.size > 2 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(file.type)
          )
            throw new Error(
              "Please use a PNG, JPEG, or WebP image under 2 MB.",
            );
          screenshot = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        const response = await fetch(this.api + "/escalations", {
          method: "POST",
          signal: AbortSignal.timeout(20000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: this.locale,
            consent: true,
            conversation: choices[0].input.checked
              ? this.history.map(({ role, content }) => ({ role, content }))
              : [],
            context: choices[1].input.checked ? this.context : undefined,
            screenshot,
          }),
        });
        if (!response.ok) throw new Error(this.t.failed);
        this.ticket = await response.json();
        this._melaLastReply = 0;
        this._melaMessage("assistant", this.t.queued + " #" + this.ticket!.id);
        cancel.click();
        this._melaShowTicket();
        this.pollTicket();
        this.dispatchEvent(
          new CustomEvent("db-assistant:escalated", {
            bubbles: true,
            composed: true,
            detail: { ticketId: this.ticket!.id },
          }),
        );
      } catch (e) {
        status.textContent = e instanceof Error ? e.message : this.t.failed;
      } finally {
        confirm.disabled = false;
      }
    };
    view.append(status, confirm, cancel);
    this._melaMessages.classList.add("hidden");
    this.root.querySelector(".composer")?.classList.add("hidden");
    this.panel.insertBefore(view, this.status);
    confirm.focus();
  }
  private _melaShowTicket() {
    this.root.querySelector(".ticket-bar")?.remove();
    const bar = el("div", undefined, "ticket-bar");
    bar.append(document.createTextNode("#" + this.ticket!.id.slice(0, 8)));
    const screen = el(
      "button",
      this._melaScreenStop ? this.t.stopScreen : this.t.shareScreen,
    );
    screen.onclick = async () => {
      if (this._melaScreenStop) {
        this._melaScreenStop();
        this._melaScreenStop = undefined;
        screen.textContent = this.t.shareScreen;
        return;
      }
      try {
        const { startSharing } = await import("./support/screen-share");
        this._melaScreenStop = await startSharing(
          this.api,
          this.ticket!,
          (text) => {
            this._melaSetStatus(text);
            if (text === "Screen sharing stopped.") {
              this._melaScreenStop = undefined;
              screen.textContent = this.t.shareScreen;
            }
          },
        );
        screen.textContent = this.t.stopScreen;
        this._melaSetStatus(this.t.screenWait);
      } catch {
        this._melaSetStatus(this.t.screenFallback);
      }
    };
    bar.append(screen);
    this.panel.insertBefore(bar, this._melaMessages);
  }
  private pollTicket() {
    clearInterval(this._melaTicketTimer);
    const poll = async () => {
      if (!this.ticket) return;
      try {
        const response = await fetch(
          this.api + "/escalations/" + this.ticket.id,
          { headers: { Authorization: "Bearer " + this.ticket.token } },
        );
        if (!response.ok) return;
        const data = await response.json();
        for (const reply of data.messages.slice(this._melaLastReply))
          this._melaMessage("tutor", reply.content);
        this._melaLastReply = data.messages.length;
        if (data.status === "resolved") {
          this._melaScreenStop?.();
          clearInterval(this._melaTicketTimer);
          this._melaSetStatus(
            this.locale === "am"
              ? "ጥያቄው ተፈትቷል"
              : "Your support ticket is resolved.",
          );
        }
      } catch {}
    };
    void poll();
    this._melaTicketTimer = setInterval(() => void poll(), 5000);
  }
  private applyReadingMode() {
    this.panel.classList.toggle("reading-mode", this._melaReadingMode);
    if (this._melaReadingMode)
      for (const details of this._melaMessages.querySelectorAll(
        ".explanation-block details",
      ))
        details.setAttribute("open", "");
  }
}
if (!customElements.get("db-assistant"))
  customElements.define("db-assistant", DBAssistant);

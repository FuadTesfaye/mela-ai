import { renderExplanationBlocks } from "./components-explanations";
import { styles } from "./styles";
import { strings } from "./i18n/strings";
import { videoEvidence, type VideoCue } from "../lib/media/video-context";
import type {
  Answer,
  Language,
  LearningContext,
  VideoSnapshot,
  ExplanationMode,
} from "../lib/types";
import { detectContext } from "./context/savanna-adapter";
import { observeContext } from "./context/context-observer";
import { loadKnowledge, offlineAnswer } from "./knowledge/offline-search";
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
  private video?: VideoSnapshot;
  private explanationMode: ExplanationMode = "auto";
  private visual?: HTMLInputElement;
  private videoCues: VideoCue[] = [];
  private scope: "lesson" | "wholeVideo" | "moment" = "lesson";
  private mediaSource(event: Event) {
    return (
      event.target instanceof HTMLElement &&
      event.target.tagName === "MELA-COURSE-MEDIA" &&
      !!event.target.closest("main,article")
    );
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
      this.version++;
      this.abort?.abort();
      this.scope = "lesson";
    }
    this.video = value;
    this.updateVideoLabel();
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
    if (!this.video || this.video.videoId !== value.videoId)
      this.scope = "wholeVideo";
    this.video = value;
    this.videoCues = detail.cues;
    this.context = detectContext(this.includePublicPage);
    this.updateVideoLabel();
  };
  private momentEvent = (event: Event) => {
    if (!this.mediaSource(event)) return;
    if (this.busy) {
      this.setStatus(
        "Please wait for the current explanation, then try this moment again.",
      );
      return;
    }
    const detail = (event as CustomEvent).detail;
    const value = this.readVideo(detail?.video);
    if (!value) return;
    this.video = value;
    this.scope = "moment";
    this.updateVideoLabel();
    this.open();
    this.input.value = "Explain this moment in the video.";
    void this.ask();
  };
  private updateVideoLabel() {
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
  private busy = false;
  private version = 0;
  private includePublicPage = false;
  private context: LearningContext = { pageType: "unknown", sections: [] };
  private knowledgeReady?: Promise<unknown>;
  private stopObserving?: () => void;
  private abort?: AbortController;
  private ticketTimer?: ReturnType<typeof setInterval>;
  private ticket?: { id: string; token: string };
  private lastReply = 0;
  private history: {
    role: string;
    content: string;
    answer?: Answer;
    question?: string;
    artifactKey?: string;
  }[] = [];
  private messages!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private launcher!: HTMLButtonElement;
  private input!: HTMLTextAreaElement;
  private status!: HTMLDivElement;
  private cloud!: HTMLInputElement;
  private lastQuestion = "";
  private recognition?: { stop: () => void };
  private screenStop?: () => void;
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
    this.locale = this.getAttribute("lang") === "am" ? "am" : "en";
    this.opened = this.hasAttribute("open");
    this.root = this.attachShadow({ mode: "open" });
    this.context = detectContext();
    this.render();
    this.stopObserving = observeContext(
      (context) => {
        if (JSON.stringify(context) === JSON.stringify(this.context)) return;
        this.context = context;
        this.version++;
        this.abort?.abort();
        this.updateContext();
        this.setStatus(this.t.contextChanged);
      },
      () => detectContext(this.includePublicPage),
    );
    window.addEventListener("mela:open", this.openEvent);
    document.addEventListener("mela:video-state", this.videoEvent);
    document.addEventListener("mela:transcript-ready", this.transcriptEvent);
    document.addEventListener("mela:explain-moment", this.momentEvent);
    this.knowledgeReady = loadKnowledge(
      this.getAttribute("content") || "/content.json",
    ).catch(() => {});
  }
  disconnectedCallback() {
    this.stopObserving?.();
    window.removeEventListener("mela:open", this.openEvent);
    document.removeEventListener("mela:video-state", this.videoEvent);
    document.removeEventListener("mela:transcript-ready", this.transcriptEvent);
    document.removeEventListener("mela:explain-moment", this.momentEvent);
    this.abort?.abort();
    clearInterval(this.ticketTimer);
    this.recognition?.stop();
    this.screenStop?.();
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
    header.append(el("span", "✦", "mark"));
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
    ]) {
      const option = el("option", label);
      option.value = value;
      language.append(option);
    }
    language.value = this.locale;
    language.onchange = () => {
      this.abort?.abort();
      this.version++;
      this.locale = language.value as Language;
      this.render();
      this.open();
    };
    toolbar.append(language, el("span", undefined, "context"));
    const scope = el(
      "button",
      this.locale === "am" ? "የገጽ መረጃ" : "Page context",
    );
    scope.title =
      "Use public text from this open page. Other tabs and private form fields are not read.";
    scope.setAttribute("aria-pressed", String(this.includePublicPage));
    scope.onclick = () => {
      if (
        !this.includePublicPage &&
        !window.confirm(
          this.locale === "am"
            ? "የዚህን ገጽ ሕዝባዊ ጽሑፍ ለጥያቄዎ መረጃ ለመጠቀም ይፈቅዳሉ?"
            : "Use the public text on this page as context for your questions? Private forms, account fields, and other tabs are excluded. Cloud AI still requires the separate sharing choice.",
        )
      )
        return;
      this.includePublicPage = !this.includePublicPage;
      this.context = detectContext(this.includePublicPage);
      this.version++;
      this.abort?.abort();
      scope.setAttribute("aria-pressed", String(this.includePublicPage));
      this.updateContext();
      this.setStatus(this.t.contextChanged);
    };
    toolbar.append(scope);
    this.messages = el("div", undefined, "messages");
    this.messages.setAttribute("role", "log");
    this.messages.setAttribute("aria-label", this.t.title);
    this.messages.setAttribute("aria-live", "polite");
    this.messages.setAttribute("aria-relevant", "additions");
    this.messages.setAttribute("tabindex", "0");
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
    privacy.append(this.cloud, document.createTextNode(this.t.privacy));
    const footer = el("div", undefined, "footer");
    const help = el("button", this.t.help);
    help.type = "button";
    help.onclick = () => this.help();
    const mic = el("button", "◉ " + this.t.mic);
    mic.type = "button";
    mic.setAttribute("aria-label", this.t.mic);
    mic.onclick = () => this.microphone(mic);
    const avatar = el("button", "✦");
    avatar.type = "button";
    avatar.setAttribute("aria-label", this.t.avatar);
    avatar.onclick = () => void this.avatar(avatar);
    footer.append(help, mic, avatar);
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
    mode.value = this.explanationMode;
    mode.onchange = () => {
      this.explanationMode = mode.value as ExplanationMode;
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
            this.message("assistant", answer.answer, false, answer);
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
    this.panel.append(
      header,
      toolbar,
      learning,
      this.messages,
      this.status,
      composer,
    );
    this.root.append(this.launcher, this.panel);
    this.message("assistant", this.t.welcome, false);
    for (const message of this.history)
      this.message(
        message.role,
        message.content,
        false,
        message.answer,
        message.question,
        message.artifactKey,
      );
    this.updateContext();
    this.updateVideoLabel();
    if (this.opened) this.open();
    if (this.ticket) this.showTicket();
  }
  private open() {
    this.opened = true;
    this.panel.classList.remove("hidden");
    this.launcher.classList.add("hidden");
    this.launcher.setAttribute("aria-expanded", "true");
    this.input.focus();
  }
  private close() {
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
  private setStatus(text: string, error = false) {
    this.status.textContent = text;
    this.status.classList.toggle("error", error);
  }
  private message(
    role: string,
    text: string,
    save = true,
    answer?: Answer,
    question = this.lastQuestion,
    artifactKey?: string,
  ) {
    if (save) {
      this.history.push({
        role,
        content: text.slice(0, 12000),
        answer,
        question,
        artifactKey,
      });
      this.history = this.history.slice(-100);
    }
    const node = el(
      "div",
      undefined,
      "message" + (role === "user" ? " user" : ""),
    );
    node.dir = "auto";
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
      listen.onclick = () => this.listen(text);
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
            this.setStatus(
              "Explanation saved on this device. Clear browser site data to remove it.",
            );
            save.textContent = "Saved offline";
          } catch {
            this.setStatus("Browser storage is unavailable.");
          }
        };
        actions.append(save);
      }
      node.append(actions);
    }
    this.messages.append(node);
    this.messages.scrollTop = this.messages.scrollHeight;
  }
  private async ask(simple = false) {
    const question = this.input.value.trim();
    if (!question || this.busy) return;
    this.lastQuestion = question;
    if (
      /^(i.d like to talk to a person|human help|የሰው እርዳታ)$/i.test(question)
    ) {
      this.help();
      return;
    }
    const snapshot = videoEvidence(
      { ...this.context, video: this.video ? { ...this.video } : undefined },
      this.videoCues,
      this.scope,
    );
    const allowVisual =
      this.scope === "moment" &&
      !!this.visual?.checked &&
      this.cloud.checked &&
      !!snapshot.video;
    if (this.scope !== "lesson" && !snapshot.sections.length && !allowVisual) {
      this.setStatus(
        "Generate or restore this video's English transcript first.",
      );
      return;
    }
    const mode = simple ? "simple" : this.explanationMode;
    this.busy = true;
    const version = this.version;
    let artifactKey: string | undefined;
    try {
      if (window.crypto?.subtle) {
        const bytes = new TextEncoder().encode(
          JSON.stringify({
            question,
            mode,
            scope: this.scope,
            language: this.locale,
            visual: allowVisual,
            course: snapshot.courseId,
            video: snapshot.video
              ? {
                  id: snapshot.video.videoId,
                  time:
                    this.scope === "moment"
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
      return;
    }
    this.input.value = "";
    this.message("user", question);
    this.dispatchEvent(
      new CustomEvent("db-assistant:question", {
        bubbles: true,
        composed: true,
        detail: { language: this.locale },
      }),
    );
    this.abort = new AbortController();
    this.setStatus(this.t.thinking);
    const timeout = setTimeout(
      () => this.abort?.abort(),
      allowVisual ? 65000 : 30000,
    );
    try {
      let answer: Answer;
      try {
        if (!navigator.onLine) throw new Error("offline");
        const response = await fetch(this.api + "/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            language: this.locale,
            context: snapshot,
            scope: this.scope,
            cloudConsent: this.cloud.checked,
            simple,
            explanationMode: mode,
            includeVisualContext: allowVisual,
          }),
          signal: this.abort.signal,
        });
        if (!response.ok) throw new Error("service");
        answer = await response.json();
        this.setStatus(answer.notice || this.t.ready);
      } catch {
        if (version !== this.version) return;
        await this.knowledgeReady;
        answer = await offlineAnswer(question, this.locale, snapshot, simple);
        this.setStatus(this.t.offline);
      }
      if (version === this.version)
        this.message(
          "assistant",
          answer.answer,
          true,
          answer,
          question,
          artifactKey,
        );
    } catch {
      this.setStatus(this.t.failed, true);
    } finally {
      clearTimeout(timeout);
      this.busy = false;
    }
  }
  private listen(text: string) {
    if (!window.speechSynthesis) {
      this.setStatus(this.t.noVoice);
      return;
    }
    const voice = speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(this.locale));
    if (!voice) {
      this.setStatus(this.t.noVoice);
      return;
    }
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = this.locale === "am" ? "am-ET" : "en-US";
    speech.voice = voice;
    speech.rate = 0.9;
    speechSynthesis.speak(speech);
  }
  private microphone(button: HTMLButtonElement) {
    const win = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Recognition) {
      this.setStatus(this.t.noMic);
      return;
    }
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = undefined;
      return;
    }
    if (!window.confirm(this.t.micWarning)) return;
    const recognition = new Recognition();
    recognition.lang = this.locale === "am" ? "am-ET" : "en-US";
    recognition.onresult = (e) => {
      this.input.value = e.results[0][0].transcript;
      this.input.focus();
    };
    recognition.onerror = () => this.setStatus(this.t.noMic);
    recognition.onend = () => {
      button.classList.remove("mic-active");
      this.recognition = undefined;
    };
    recognition.start();
    this.recognition = recognition;
    button.classList.add("mic-active");
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
      this.messages.classList.remove("hidden");
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
        this.lastReply = 0;
        this.message("assistant", this.t.queued + " #" + this.ticket!.id);
        cancel.click();
        this.showTicket();
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
    this.messages.classList.add("hidden");
    this.root.querySelector(".composer")?.classList.add("hidden");
    this.panel.insertBefore(view, this.status);
    confirm.focus();
  }
  private showTicket() {
    this.root.querySelector(".ticket-bar")?.remove();
    const bar = el("div", undefined, "ticket-bar");
    bar.append(document.createTextNode("#" + this.ticket!.id.slice(0, 8)));
    const screen = el(
      "button",
      this.screenStop ? this.t.stopScreen : this.t.shareScreen,
    );
    screen.onclick = async () => {
      if (this.screenStop) {
        this.screenStop();
        this.screenStop = undefined;
        screen.textContent = this.t.shareScreen;
        return;
      }
      try {
        const { startSharing } = await import("./support/screen-share");
        this.screenStop = await startSharing(this.api, this.ticket!, (text) => {
          this.setStatus(text);
          if (text === "Screen sharing stopped.") {
            this.screenStop = undefined;
            screen.textContent = this.t.shareScreen;
          }
        });
        screen.textContent = this.t.stopScreen;
        this.setStatus(this.t.screenWait);
      } catch {
        this.setStatus(this.t.screenFallback);
      }
    };
    bar.append(screen);
    this.panel.insertBefore(bar, this.messages);
  }
  private pollTicket() {
    clearInterval(this.ticketTimer);
    const poll = async () => {
      if (!this.ticket) return;
      try {
        const response = await fetch(
          this.api + "/escalations/" + this.ticket.id,
          { headers: { Authorization: "Bearer " + this.ticket.token } },
        );
        if (!response.ok) return;
        const data = await response.json();
        for (const reply of data.messages.slice(this.lastReply))
          this.message("tutor", reply.content);
        this.lastReply = data.messages.length;
        if (data.status === "resolved") {
          this.screenStop?.();
          clearInterval(this.ticketTimer);
          this.setStatus(
            this.locale === "am"
              ? "ጥያቄው ተፈትቷል"
              : "Your support ticket is resolved.",
          );
        }
      } catch {}
    };
    void poll();
    this.ticketTimer = setInterval(() => void poll(), 5000);
  }
  private async avatar(button: HTMLButtonElement) {
    const current = this.root.querySelector(".avatar-host");
    if (current) {
      current.remove();
      button.setAttribute("aria-label", this.t.avatar);
      return;
    }
    const host = el("div", undefined, "avatar-host");
    host.setAttribute("aria-hidden", "true");
    this.panel.insertBefore(host, this.messages);
    button.setAttribute("aria-label", this.t.hideAvatar);
    try {
      const script = document.querySelector<HTMLScriptElement>(
        'script[src*="db-assistant.js"]',
      );
      const moduleUrl = new URL(
        "avatar-view.js",
        script?.src || new URL("/db-assistant.js", location.href),
      ).href;
      const { mountAvatar } = await import(moduleUrl);
      mountAvatar(host);
    } catch {
      host.remove();
    }
  }
}
interface Recognition {
  lang: string;
  onresult: (e: {
    results: { [key: number]: { [key: number]: { transcript: string } } };
  }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
if (!customElements.get("db-assistant"))
  customElements.define("db-assistant", DBAssistant);

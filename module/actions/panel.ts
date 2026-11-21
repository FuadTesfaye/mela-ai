import { createActionEngine, parseAction, type ActionResult } from "./engine";
import { create as createVoice } from "../voice/input";
import { isLanguage, languages, type Language } from "../../lib/languages";
import { mountSignBox } from "./sign-box";
import { courseMediaStyles } from "../media/course-media-styles";
import { extractPage, summarizeData, type PageData } from "./extract";
export function mountActions(
  options: {
    root?: ParentNode;
    api?: string;
    container?: HTMLElement;
    language?: Language;
    shadowMode?: ShadowRootMode;
    extraControls?: HTMLElement;
    question?: (question: string, language: Language) => Promise<ActionResult>;
    /** Show the course sign-language box and time it to spoken answers. */
    signBox?: { runtimeUrl: string; storyboardUrl: string };
    /** Read question answers aloud automatically. */
    speakAnswers?: boolean;
    /** Show the big Talk button, hands-free Jarvis mode and web-data extraction. */
    assistant?: boolean;
    transcribe?: (
      audio: string,
      mimeType: string,
      language: Language,
    ) => Promise<string>;
  } = {},
) {
  const container = options.container || document.body;
  const host = document.createElement("section");
  host.dataset.melaActionsUi = "";
  host.setAttribute("aria-label", "MELA web voice assistant");
  const shadow = host.attachShadow({ mode: options.shadowMode || "open" });
  const style = document.createElement("style");
  const panelCss =
    ":host{display:block;position:fixed;bottom:18px;right:18px;z-index:2147483647;width:min(420px,calc(100vw - 36px));font:16px/1.5 system-ui;color:#17394e}details{max-height:calc(100dvh - 48px);overflow:auto;background:#fff;border:2px solid #087e8b;border-radius:14px;box-shadow:0 8px 40px #103c4b33;padding:14px}summary{cursor:pointer;font-weight:bold;min-height:44px}button,textarea,select{font:inherit;margin:6px 4px 6px 0;padding:9px;min-height:44px;border:2px solid #526e78;border-radius:6px}button{cursor:pointer;background:#103c4b;color:white}textarea{box-sizing:border-box;width:100%;color:#17394e;background:white}*:focus-visible{outline:3px solid #b46d05;outline-offset:3px}[role=status]{max-height:220px;overflow:auto;white-space:pre-wrap}label{display:block}";
  style.textContent = panelCss;
  if (options.signBox)
    style.textContent +=
      courseMediaStyles +
      panelCss +
      ":host{width:min(460px,calc(100vw - 36px))}.sign-box{width:100%;margin-top:10px}.sign-box button,.sign-box select{min-height:0;margin:0;color:#16445e;background:#fff;border:1px solid #b5cbd8}.sign-box .preview-generate{display:none}.teacher-surface{aspect-ratio:auto;height:260px}.gesture-viewport svg{max-height:260px}.mela-toolbar{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.mela-toolbar label{display:flex;gap:6px;align-items:center;font-size:14px}.mela-toolbar input{width:20px;height:20px}";
  if (options.assistant)
    style.textContent +=
      ".mela-talk-row{display:grid;grid-template-columns:1fr 1fr;gap:6px}.mela-talk-row button{margin:0;min-height:56px;font-size:17px;font-weight:700}.talk{background:#087e8b;border-color:#087e8b}.talk[data-voice-state=listening],.talk[data-voice-state=starting],.talk[data-voice-state=recording]{background:#b3261e;border-color:#b3261e;animation:mela-pulse 1.2s infinite}.jarvis[aria-pressed=true]{background:#b46d05;border-color:#b46d05}.extract{width:100%;margin:6px 0 0;background:#fff;color:#103c4b}.mela-data{display:flex;flex-wrap:wrap;gap:4px}.mela-data button{font-size:14px;min-height:38px;padding:6px 10px;margin:2px 0}.jarvis-state{margin:6px 0 0;font-size:14px;font-weight:600;color:#7a4a00}@keyframes mela-pulse{50%{box-shadow:0 0 0 6px #b3261e33}}@media(prefers-reduced-motion:reduce){.talk{animation:none!important}}";
  shadow.append(style);
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "MELA · Talk to this website";
  details.append(summary);
  const help = document.createElement("p");
  help.textContent =
    "Try “read page”, “scroll down”, “find Downloads”, “click Next” or “fill Name with …”. Actions use this page only." +
    (options.question
      ? " Or just ask any question about this page — type it or use the microphone — and MELA answers out loud."
      : "");
  const input = document.createElement("textarea");
  input.maxLength = 2000;
  input.rows = 2;
  input.setAttribute("aria-label", "Web command");
  const output = document.createElement("div");
  output.tabIndex = 0;
  output.setAttribute("aria-label", "Web command result");
  output.setAttribute("role", "status");
  output.setAttribute("aria-live", "polite");
  const controls = document.createElement("div");
  const confirm = document.createElement("div");
  const engine = createActionEngine(options.root || document);
  let language = options.language || "en";
  let request = 0,
    disposed = false;
  const b = (label: string, fn: () => unknown) => {
    const e = document.createElement("button");
    e.type = "button";
    e.textContent = label;
    e.onclick = () => {
      try {
        Promise.resolve(fn()).catch(() => {
          if (!disposed)
            output.textContent = "The action is unavailable. Please try again.";
        });
      } catch {
        output.textContent =
          "The page changed or the action is unavailable. Please try again.";
      }
    };
    return e;
  };
  const show = (result: ActionResult) => {
    output.textContent = result.message;
    if (result.sources?.length) {
      const list = document.createElement("ul");
      for (const source of result.sources) {
        try {
          const url = new URL(source.url);
          if (!["http:", "https:"].includes(url.protocol)) continue;
          const item = document.createElement("li"),
            link = document.createElement("a");
          link.textContent = source.title;
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          item.append(link);
          list.append(item);
        } catch {}
      }
      output.append(list);
    }
    confirm.replaceChildren();
    if (result.status === "confirm")
      confirm.append(
        b("Confirm action", () => show(engine.confirm())),
        b("Cancel action", () => {
          engine.cancel();
          confirm.replaceChildren();
          output.textContent = "Cancelled.";
        }),
      );
    if (result.choices)
      for (const choice of result.choices)
        confirm.append(b(choice.name, () => show(engine.choose(choice.id))));
  };
  let signBox: ReturnType<typeof mountSignBox> | undefined;
  const speakToggle = document.createElement("input");
  speakToggle.type = "checkbox";
  speakToggle.checked = options.speakAnswers ?? false;
  let jarvis = false,
    jarvisAccepted = false;
  const speak = (text: string, force = false): Promise<void> => {
    const lang = language === "am" ? "am" : "en";
    signBox?.play(text, lang);
    if (!(speakToggle.checked || force) || !("speechSynthesis" in window))
      return Promise.resolve();
    const voices = window.speechSynthesis.getVoices();
    const want = languages[language]?.speech?.toLowerCase() || language;
    const voice =
      voices.find((v) => v.lang.toLowerCase() === want) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(language));
    if (!voice && language !== "en") return Promise.resolve(); // captions + sign box still show
    window.speechSynthesis.cancel();
    const spoken = text.slice(0, 4000);
    const utterance = new SpeechSynthesisUtterance(spoken);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    return new Promise((resolve) => {
      // onend is unreliable in some browsers; never wait forever.
      const fallback = setTimeout(
        resolve,
        (spoken.split(/\s+/).length / 2.2) * 1000 + 5000,
      );
      const done = () => {
        clearTimeout(fallback);
        signBox?.stop();
        resolve();
      };
      utterance.onstart = () => signBox?.play(text, lang);
      utterance.onboundary = (e) => signBox?.sync(e.charIndex);
      utterance.onend = done;
      // No usable voice (common on Linux): keep the sign box and captions
      // playing on their own timer instead of stopping them.
      utterance.onerror = () => {
        clearTimeout(fallback);
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  };
  // ---- Web data extraction ----
  let extracted: PageData | undefined;
  const dataActions = document.createElement("div");
  dataActions.className = "mela-data";
  const extract = () => {
    extracted = extractPage();
    const summary = summarizeData(extracted);
    output.textContent = summary;
    const json = () => JSON.stringify(extracted, null, 2);
    dataActions.replaceChildren(
      b("Download JSON", () => {
        const url = URL.createObjectURL(
          new Blob([json()], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download =
          (location.hostname || "page").replace(/[^a-z0-9.-]/gi, "_") +
          "-data.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }),
      b("Copy JSON", async () => {
        await navigator.clipboard.writeText(json());
        output.textContent = summary + "\nCopied to the clipboard.";
      }),
      ...(options.question
        ? [
            b("Summarize with Gemini", () => {
              input.value =
                "Summarize the main information on this page in a few sentences.";
              return run();
            }),
          ]
        : []),
    );
    return summary;
  };
  // ---- Jarvis: hands-free conversation loop ----
  const jarvisState = document.createElement("p");
  jarvisState.className = "jarvis-state";
  jarvisState.hidden = true;
  const listenAgain = () => {
    if (!jarvis || disposed) return;
    jarvisState.textContent = "Jarvis is listening… say “stop” to end.";
    setTimeout(() => {
      if (jarvis && !disposed && voice.idle()) {
        input.value = "";
        voice.toggle();
      }
    }, 350);
  };
  const stopJarvis = (message = "Jarvis stopped.") => {
    jarvis = false;
    jarvisButton.setAttribute("aria-pressed", "false");
    jarvisButton.textContent = "🤖 Start Jarvis";
    jarvisState.hidden = true;
    voice.cancel();
    output.textContent = message;
  };
  const startJarvis = async () => {
    if (jarvis) {
      window.speechSynthesis?.cancel();
      stopJarvis();
      return;
    }
    if (
      !jarvisAccepted &&
      !window.confirm(
        "Jarvis listens through your browser's speech service, answers out loud, and keeps listening until you say “stop”. Start Jarvis?",
      )
    )
      return;
    jarvisAccepted = true;
    jarvis = true;
    jarvisButton.setAttribute("aria-pressed", "true");
    jarvisButton.textContent = "⏹ Stop Jarvis";
    jarvisState.hidden = false;
    jarvisState.textContent = "Jarvis is on.";
    await speak(
      language === "am"
        ? "ሰላም፣ እኔ መላ ነኝ። ምን ልርዳዎት?"
        : "Hi, I'm MELA. Ask me anything about this page, or tell me what to do.",
      true,
    );
    listenAgain();
  };
  const reply = async (message: string) => {
    if (jarvis) {
      jarvisState.textContent = "Jarvis is speaking…";
      await speak(message, true);
      listenAgain();
    } else await speak(message);
  };
  const run = async () => {
    const id = ++request;
    const text = input.value.trim();
    if (
      jarvis &&
      /^(stop( jarvis| listening)?|goodbye|good bye|bye|exit|thank you,? that'?s all|አቁም|ቻው)[.!]?$/iu.test(
        text,
      )
    ) {
      window.speechSynthesis?.cancel();
      stopJarvis("Jarvis stopped. Press Start Jarvis to talk again.");
      void speak(language === "am" ? "ደህና ሁኑ።" : "Goodbye!", true);
      return;
    }
    if (
      options.assistant &&
      /^(extract|scrape|get|collect)( the| this)?( web| page| website)?( data| content| page)?$/iu.test(
        text.replace(/[.!?]+$/, ""),
      ) &&
      /extract|scrape|data|content/iu.test(text)
    ) {
      const summary = extract();
      if (jarvis) await reply(summary.split("\n")[0]);
      return;
    }
    const action = parseAction(text);
    if (action) {
      const result = engine.execute(action);
      show(result);
      if (jarvis)
        await reply(
          result.status === "confirm"
            ? result.message + " Say confirm or press Confirm action."
            : result.message,
        );
      return;
    }
    if (jarvis && /^(confirm|yes,? (do it|confirm))[.!]?$/iu.test(text)) {
      const result = engine.confirm();
      show(result);
      await reply(result.message);
      return;
    }
    engine.cancel();
    confirm.replaceChildren();
    if (options.question && text) {
      output.textContent = "Searching this page and saved site context…";
      try {
        const answer = await options.question(text, language);
        if (!disposed && id === request) {
          show(answer);
          if (answer.status !== "unsupported" || jarvis)
            await reply(answer.message);
        }
      } catch {
        if (!disposed && id === request)
          output.textContent =
            "Saved context is unavailable. Try a current-page command.";
      }
      return;
    }
    output.textContent =
      "Command not recognised. Try one of the examples above.";
    if (jarvis) listenAgain();
  };

  const locale = document.createElement("select");
  locale.setAttribute("aria-label", "Command language");
  for (const [code, info] of Object.entries(languages)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = info.name;
    locale.append(option);
  }
  locale.value = language;
  locale.onchange = () => {
    request++;
    if (jarvis) stopJarvis();
    voice.cancel();
    engine.cancel();
    confirm.replaceChildren();
    language = isLanguage(locale.value) ? locale.value : "en";
  };
  const mic = b(options.assistant ? "🎙 Talk" : "Use microphone", () => {
    if (jarvis) window.speechSynthesis?.cancel();
    voice.toggle();
  });
  mic.className = "talk";
  const jarvisButton = b("🤖 Start Jarvis", startJarvis);
  jarvisButton.className = "jarvis";
  jarvisButton.setAttribute("aria-pressed", "false");
  const extractButton = b("📄 Extract web data", () => {
    const summary = extract();
    if (jarvis) void reply(summary.split("\n")[0]);
  });
  extractButton.className = "extract";
  const voice = createVoice({
    transcribe: options.transcribe,
    useLabel: options.assistant ? "🎙 Talk" : undefined,
    skipWarning: () => jarvis && jarvisAccepted,
    onFinal: () => void run(),
    onEnd: (outcome) => {
      if (!jarvis) return;
      if (outcome === "none") listenAgain();
      if (outcome === "error")
        stopJarvis(
          "Jarvis stopped because the microphone is unavailable. Check microphone permission and try again.",
        );
    },
    input,
    button: mic,
    language: () => language,
    status: (message) => {
      output.textContent = message;
    },
    api: options.api || new URL("/api/v1", location.href).href,
  });
  controls.append(
    b("Run command", run),
    ...(options.assistant ? [] : [mic]),
    b("Stop", () => {
      request++;
      if (jarvis) stopJarvis();
      voice.cancel();
      engine.cancel();
      confirm.replaceChildren();
      window.speechSynthesis?.cancel();
      signBox?.stop();
      output.textContent = "Stopped. Pending actions cancelled.";
    }),
  );
  controls.append(
    b("Listen to result", () => {
      const text = output.textContent || "";
      if (!text || !("speechSynthesis" in window)) return;
      const sourceLanguage =
        document.documentElement.lang.split("-")[0] || "en";
      const matching = window.speechSynthesis
        .getVoices()
        .find((v) =>
          v.lang.toLowerCase().startsWith(sourceLanguage.toLowerCase()),
        );
      if (!matching) {
        output.textContent =
          "No matching device voice is available. Please read the result.";
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 2000));
      utterance.voice = matching;
      window.speechSynthesis.speak(utterance);
    }),
  );
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      void run();
    }
  });
  const toolbar = document.createElement("div");
  toolbar.className = "mela-toolbar";
  const speakLabel = document.createElement("label");
  speakLabel.append(speakToggle, "Read answers aloud");
  toolbar.append(locale, speakLabel);
  if (options.assistant) {
    const talkRow = document.createElement("div");
    talkRow.className = "mela-talk-row";
    talkRow.append(mic, jarvisButton);
    details.append(help, talkRow, jarvisState, extractButton, toolbar);
  } else details.append(help, toolbar);
  details.append(input, controls, output, dataActions, confirm);
  if (options.signBox) signBox = mountSignBox(details, options.signBox);
  if (options.extraControls) details.append(options.extraControls);
  shadow.append(details);
  container.append(host);
  const cancel = () => {
    request++;
    voice.cancel();
    engine.cancel();
    confirm.replaceChildren();
  };
  const close = () => {
    if (!details.open) {
      if (jarvis) stopJarvis();
      voice.cancel();
      cancel();
    }
  };
  details.addEventListener("toggle", close);
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      details.open = false;
      cancel();
      summary.focus();
    }
  };
  host.addEventListener("keydown", key);
  return {
    element: host,
    setLanguage(value: Language) {
      if (isLanguage(value)) {
        request++;
        voice.cancel();
        engine.cancel();
        confirm.replaceChildren();
        language = value;
        locale.value = value;
      }
    },
    destroy() {
      disposed = true;
      jarvis = false;
      window.speechSynthesis?.cancel();
      signBox?.dispose();
      request++;
      voice.stop();
      engine.cancel();
      host.remove();
    },
    open() {
      details.open = true;
      input.focus();
    },
  };
}

import { createActionEngine, parseAction, type ActionResult } from "./engine";
import { create as createVoice } from "../voice/input";
import { isLanguage, languages, type Language } from "../../lib/languages";
import { mountSignBox } from "./sign-box";
import { courseMediaStyles } from "../media/course-media-styles";
import { extractPage, summarizeData, type PageData } from "./extract";
export type LiveStatus =
  | "live"
  | "listening"
  | "thinking"
  | "speaking"
  | "jarvis";
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
    /** Live status for outside indicators (e.g. the extension toolbar badge). */
    onStatus?: (status: LiveStatus) => void;
    /** Natural voice (base64 WAV) used when the device has no voice, or when preferred. */
    tts?: (text: string, language: Language) => Promise<string>;
    voiceMode?: () => "auto" | "gemini" | "device";
    onLanguageChange?: (language: Language) => void;
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
      ".mela-talk-row{display:grid;grid-template-columns:1fr 1fr;gap:6px}.mela-talk-row button{margin:0;min-height:56px;font-size:17px;font-weight:700}.talk{background:#087e8b;border-color:#087e8b}.talk[data-voice-state=listening],.talk[data-voice-state=starting],.talk[data-voice-state=recording]{background:#b3261e;border-color:#b3261e;animation:mela-pulse 1.2s infinite}.jarvis[aria-pressed=true]{background:#b46d05;border-color:#b46d05}.extract{width:100%;margin:6px 0 0;background:#fff;color:#103c4b}.mela-data{display:flex;flex-wrap:wrap;gap:4px}.mela-data button{font-size:14px;min-height:38px;padding:6px 10px;margin:2px 0}.jarvis-state{margin:6px 0 0;font-size:14px;font-weight:600;color:#7a4a00}:host([data-closed]){width:auto}:host([data-closed]) details{border-radius:999px;padding:6px 14px 6px 10px}:host([data-closed]) .mela-sub{display:none}summary{display:flex;align-items:center;gap:10px;list-style:none}summary::-webkit-details-marker{display:none}.mela-brand{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#087e8b,#103c4b);color:#fff;font-size:10px;letter-spacing:.5px}.mela-sub{flex:1}.live-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.6px;padding:4px 10px;border-radius:999px;background:#e5f6ec;color:#0a6b30;white-space:nowrap}.live-pill b{width:9px;height:9px;border-radius:50%;background:#12a150;box-shadow:0 0 0 0 #12a15088;animation:mela-dot 1.6s infinite}.live-pill .bars{display:none}.live-pill[data-state=listening]{background:#fde8e7;color:#b3261e}.live-pill[data-state=listening] b{background:#d93025;box-shadow:0 0 0 0 #d9302588}.live-pill[data-state=listening] .bars,.live-pill[data-state=speaking] .bars{display:inline-flex}.live-pill[data-state=thinking]{background:#fff4dc;color:#8a5300}.live-pill[data-state=thinking] b{background:#e0a100}.live-pill[data-state=speaking]{background:#e3effd;color:#0b57d0}.live-pill[data-state=speaking] b{background:#0b57d0}.live-pill[data-state=jarvis]{background:#f1e8fd;color:#6a2fb5}.live-pill[data-state=jarvis] b{background:#8e44e0}.bars{display:inline-flex;gap:2px;align-items:center;height:14px}.bars i{display:block;width:3px;height:100%;border-radius:2px;background:currentColor;animation:mela-bar .9s ease-in-out infinite}.bars i:nth-child(2){animation-delay:-.7s}.bars i:nth-child(3){animation-delay:-.4s}.bars i:nth-child(4){animation-delay:-.2s}.bars i:nth-child(5){animation-delay:-.55s}.mic-banner{display:flex;align-items:center;gap:10px;margin:8px 0 0;padding:10px 14px;border-radius:10px;background:#d93025;color:#fff;font-weight:700;font-size:16px}.mic-banner .bars{height:20px;margin-left:auto}.mic-banner .bars i{width:4px}.talk:hover{background:#066a75!important;color:#fff}.jarvis:hover{background:#0b3140;color:#fff}.jarvis[aria-pressed=true]:hover{background:#9a5c00}.mela-composer .send:hover{background:#066a75}.mela-tools button:hover{filter:brightness(1.15)}.mela-tools .extract:hover{background:#eef6f8;filter:none}details details{border:1px solid #dfe9ec;box-shadow:none;padding:2px 12px;border-radius:10px;margin-top:8px;font-size:14px;max-height:none}details details summary{min-height:36px;font-weight:600;font-size:14px}details details button{min-height:36px;padding:5px 10px;font-size:13px}.mela-chat{display:flex;flex-direction:column;gap:8px;max-height:240px;min-height:90px;overflow:auto;padding:10px 2px 4px}.msg{max-width:88%;padding:9px 13px;border-radius:16px;font-size:15px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.msg.mela{align-self:flex-start;background:#eef6f8;color:#123a4b;border-bottom-left-radius:4px}.msg.you{align-self:flex-end;background:#087e8b;color:#fff;border-bottom-right-radius:4px}.msg ul{margin:6px 0 0;padding-left:18px;font-size:13px}.msg a{color:inherit}.mela-composer{display:flex;gap:6px;align-items:flex-end;margin-top:8px}.mela-composer textarea{margin:0;flex:1;min-height:46px;resize:none;border-radius:12px;border:2px solid #c3d6dd;padding:10px 12px}.mela-composer .send{margin:0;width:46px;min-width:46px;height:46px;border-radius:50%;padding:0;background:#087e8b;border-color:#087e8b;font-size:18px}.mela-talk-row{margin-top:8px}.mela-status{min-height:0;font-size:13px;color:#4f6b78;margin-top:6px}.mela-status:empty{display:none}.mela-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid #e2ecef}.mela-tools button,.mela-tools select{margin:0;min-height:38px;padding:6px 10px;font-size:14px;border-width:1px}.mela-tools .extract{width:auto;flex:1}.mela-tools label{display:flex;align-items:center;gap:4px;font-size:18px}.mela-tools input{width:18px;height:18px}.sign-box .gesture-note,.sign-box .alphabet-reference,.sign-box .gesture-description,.sign-box .motion-toggle,.sign-box .motion-state,.sign-box .live-caption small,.sign-box .teacher-renderer-status,.sign-box .teacher-cameras,.sign-box .teacher-tools select,.sign-box .concept-card{display:none!important}.sign-box .teacher-surface{height:200px}.sign-box .live-caption{padding:8px 12px}.sign-box .caption-words{font-size:15px;margin:4px 0;max-height:90px}.sign-box .preview-mode,.sign-box .animation-controls{padding:6px 8px}.sign-box .animation-controls{grid-template-columns:1fr}.sign-box .teacher-tools{padding:0}@keyframes mela-dot{70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}@keyframes mela-bar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}@media(prefers-reduced-motion:reduce){.bars i,.live-pill b{animation:none}}@keyframes mela-pulse{50%{box-shadow:0 0 0 6px #b3261e33}}@media(prefers-reduced-motion:reduce){.talk{animation:none!important}}";
  shadow.append(style);
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const brand = document.createElement("span");
  brand.className = "mela-brand";
  brand.textContent = "MELA";
  const subtitle = document.createElement("span");
  subtitle.className = "mela-sub";
  subtitle.textContent = "Talk to this website";
  const pill = document.createElement("span");
  pill.className = "live-pill";
  pill.setAttribute("role", "status");
  pill.setAttribute("aria-live", "polite");
  const bars = () => {
    const wrap = document.createElement("span");
    wrap.className = "bars";
    wrap.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 5; i++) wrap.append(document.createElement("i"));
    return wrap;
  };
  const pillText = document.createElement("span");
  pill.append(document.createElement("b"), pillText, bars());
  if (options.assistant) summary.append(brand, subtitle, pill);
  else summary.textContent = "MELA · Talk to this website";
  details.append(summary);
  const micBanner = document.createElement("div");
  micBanner.className = "mic-banner";
  micBanner.hidden = true;
  const micText = document.createElement("span");
  micBanner.append("🎙", micText, bars());
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
  // Assistant mode shows the conversation as chat bubbles.
  const chat = document.createElement("div");
  chat.className = "mela-chat";
  chat.setAttribute("role", "log");
  chat.setAttribute("aria-label", "Conversation with MELA");
  const bubble = (who: "you" | "mela", text: string) => {
    const message = document.createElement("div");
    message.className = "msg " + who;
    message.textContent = text;
    if (/[\u1200-\u137f]/.test(text)) message.lang = "am";
    chat.append(message);
    while (chat.children.length > 40) chat.firstElementChild?.remove();
    chat.scrollTop = chat.scrollHeight;
    return message;
  };
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
    const target = options.assistant ? bubble("mela", result.message) : output;
    output.textContent = options.assistant ? "" : result.message;
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
      target.append(list);
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
  // ---- Voice output: device voice, or a natural Gemini voice ----
  let speechToken = 0,
    audioContext: AudioContext | undefined,
    currentSource: AudioBufferSourceNode | undefined;
  const ensureAudio = () => {
    try {
      audioContext ??= new AudioContext();
      void audioContext.resume();
    } catch {}
  };
  const stopSpeech = () => {
    speechToken++;
    try {
      currentSource?.stop();
    } catch {}
    currentSource = undefined;
    window.speechSynthesis?.cancel();
  };
  const deviceVoice = async () => {
    if (!("speechSynthesis" in window)) return undefined;
    if (!window.speechSynthesis.getVoices().length)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 500);
        window.speechSynthesis.addEventListener?.(
          "voiceschanged",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    const voices = window.speechSynthesis.getVoices();
    const want = languages[language]?.speech?.toLowerCase() || language;
    return (
      voices.find((v) => v.lang.toLowerCase() === want) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(language))
    );
  };
  const chunksOf = (text: string) => {
    const chunks: { text: string; from: number }[] = [];
    const re = /[^.!?።]+[.!?።]*\s*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const last = chunks.at(-1);
      if (last && last.text.length + m[0].length < 240 && chunks.length > 1)
        last.text += m[0];
      else chunks.push({ text: m[0], from: m.index });
    }
    return chunks.filter((c) => c.text.trim());
  };
  // Per language: an English voice failure must not silence Amharic.
  const naturalPausedUntil: Record<string, number> = {};
  const speakNatural = async (
    text: string,
    lang: "en" | "am",
    token: number,
  ) => {
    ensureAudio();
    const context = audioContext;
    if (!context || !options.tts) return text;
    const chunks = chunksOf(text.slice(0, 4000));
    const loads: Promise<AudioBuffer | undefined>[] = [];
    const load = (i: number) =>
      (loads[i] ??= options.tts!(chunks[i].text.trim(), language)
        .then((b64) =>
          context.decodeAudioData(
            Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer,
          ),
        )
        .catch(() => undefined));
    load(0);
    if (chunks.length > 1) load(1);
    for (let i = 0; i < chunks.length; i++) {
      const buffer = await load(i);
      if (i + 2 < chunks.length) load(i + 2);
      if (token !== speechToken) return "";
      // Gemini voice unavailable (e.g. daily quota): hand the rest to the device voice.
      if (!buffer) {
        naturalPausedUntil[language] = Date.now() + 10 * 60 * 1000;
        return text.slice(chunks[i].from);
      }
      if (i === 0) signBox?.play(text, lang);
      else signBox?.sync(chunks[i].from);
      await new Promise<void>((resolve) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => resolve();
        currentSource = source;
        source.start();
      });
      if (token !== speechToken) return "";
    }
    signBox?.stop();
    return "";
  };
  const speak = async (text: string, force = false): Promise<void> => {
    const lang = language === "am" ? "am" : "en";
    signBox?.play(text, lang);
    if (!(speakToggle.checked || force)) return;
    stopSpeech();
    const token = speechToken;
    const mode = options.voiceMode?.() || "auto";
    const voice = mode === "gemini" ? undefined : await deviceVoice();
    if (token !== speechToken) return;
    if (
      options.tts &&
      Date.now() > (naturalPausedUntil[language] || 0) &&
      (mode === "gemini" || (mode === "auto" && !voice))
    ) {
      const rest = await speakNatural(text, lang, token);
      if (!rest || token !== speechToken) return;
      text = rest;
    }
    if (!("speechSynthesis" in window)) return;
    // No matching voice: English can use any installed voice; other scripts
    // stay as captions and the sign box rather than being misread.
    if (!voice && language !== "en") return;
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
  // ---- Live status (pill in the header, microphone banner, outside badge) ----
  let micState = "idle",
    thinking = false,
    speaking = false,
    lastStatus: LiveStatus | undefined;
  const labels: Record<LiveStatus, string> = {
    live: "LIVE",
    listening: "MIC ON · LISTENING",
    thinking: "THINKING",
    speaking: "SPEAKING",
    jarvis: "JARVIS ON",
  };
  const updateStatus = () => {
    const status: LiveStatus =
      micState === "processing"
        ? "thinking"
        : micState !== "idle"
          ? "listening"
          : thinking
            ? "thinking"
            : speaking
              ? "speaking"
              : jarvis
                ? "jarvis"
                : "live";
    pill.dataset.state = status;
    host.dataset.state = status;
    pillText.textContent = labels[status];
    micBanner.hidden = status !== "listening";
    micText.textContent =
      micState === "starting"
        ? "Turning the microphone on…"
        : "Microphone is ON — speak now";
    if (status !== lastStatus) {
      lastStatus = status;
      options.onStatus?.(status);
    }
  };
  const speakTracked = async (text: string, force = false) => {
    speaking = true;
    updateStatus();
    try {
      await speak(text, force);
    } finally {
      speaking = false;
      updateStatus();
    }
  };
  // ---- Web data extraction ----
  let extracted: PageData | undefined;
  const dataActions = document.createElement("div");
  dataActions.className = "mela-data";
  const extract = () => {
    extracted = extractPage();
    const summary = summarizeData(extracted);
    if (options.assistant) bubble("mela", summary);
    else output.textContent = summary;
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
    updateStatus();
  };
  const startJarvis = async () => {
    if (jarvis) {
      stopSpeech();
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
    updateStatus();
    await speakTracked(
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
      await speakTracked(message, true);
      listenAgain();
    } else await speakTracked(message);
  };
  const run = async () => {
    const id = ++request;
    const text = input.value.trim();
    if (options.assistant) {
      if (!text) return;
      bubble("you", text);
      input.value = "";
    }
    const words = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .trim()
      .split(/\s+/);
    if (
      jarvis &&
      words.length <= 6 &&
      words.some((w) =>
        ["stop", "goodbye", "bye", "exit", "አቁም", "ቻው"].includes(w),
      )
    ) {
      stopSpeech();
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
    // Voice transcripts often carry filler ("Okay. Scroll down."): also try the last sentence.
    const action =
      parseAction(text) ||
      parseAction(
        text
          .split(/[.!?።,]\s+/)
          .filter(Boolean)
          .at(-1) || "",
      );
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
      output.textContent = options.assistant
        ? "Thinking…"
        : "Searching this page and saved site context…";
      thinking = true;
      updateStatus();
      try {
        const answer = await options.question(text, language).finally(() => {
          thinking = false;
          updateStatus();
        });
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
    if (options.assistant)
      bubble("mela", "Sorry, I didn't catch that. Try again.");
    else
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
    options.onLanguageChange?.(language);
  };
  const mic = b(options.assistant ? "🎙 Talk" : "Use microphone", () => {
    if (jarvis) stopSpeech();
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
    autoMode: options.assistant,
    skipWarning: () => jarvis && jarvisAccepted,
    onFinal: () => void run(),
    onState: (value) => {
      micState = value;
      updateStatus();
    },
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
  const stopAll = () => {
    request++;
    if (jarvis) stopJarvis();
    voice.cancel();
    engine.cancel();
    confirm.replaceChildren();
    stopSpeech();
    signBox?.stop();
    output.textContent = options.assistant
      ? "Stopped."
      : "Stopped. Pending actions cancelled.";
  };
  controls.append(
    b("Run command", run),
    ...(options.assistant ? [] : [mic]),
    b("Stop", () => stopAll()),
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
  let toolsRow: HTMLElement | undefined;
  if (options.assistant) {
    // Clean chat layout: conversation, sign box, composer, big voice buttons, tools.
    const talkRow = document.createElement("div");
    talkRow.className = "mela-talk-row";
    talkRow.append(mic, jarvisButton);
    const composer = document.createElement("div");
    composer.className = "mela-composer";
    input.rows = 1;
    input.placeholder = "Ask about this page…";
    const send = b("➤", run);
    send.className = "send";
    send.setAttribute("aria-label", "Send");
    composer.append(input, send);
    const tools = document.createElement("div");
    tools.className = "mela-tools";
    toolsRow = tools;
    const stop = b("⏹ Stop", stopAll);
    extractButton.textContent = "📄 Extract data";
    const speakLabel2 = document.createElement("label");
    speakLabel2.append(speakToggle, "🔊");
    speakLabel2.title = "Read answers aloud";
    tools.append(extractButton, locale, speakLabel2, stop);
    output.className = "mela-status";
    const signHost = document.createElement("div");
    bubble(
      "mela",
      "Hi, I'm MELA 👋 Tap Talk or type a question about this page.",
    );
    details.append(
      chat,
      signHost,
      composer,
      talkRow,
      micBanner,
      jarvisState,
      output,
      dataActions,
      confirm,
      tools,
    );
    if (options.signBox) signBox = mountSignBox(signHost, options.signBox);
  } else {
    details.append(help, toolbar);
    details.append(input, controls, output, dataActions, confirm);
    if (options.signBox) signBox = mountSignBox(details, options.signBox);
  }
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
  details.addEventListener("toggle", () => {
    host.toggleAttribute("data-closed", !details.open);
  });
  host.toggleAttribute("data-closed", true);
  updateStatus();
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      details.open = false;
      cancel();
      summary.focus();
    }
  };
  host.addEventListener("keydown", key);
  // Unlock audio playback on the user's first interaction with the panel.
  host.addEventListener("pointerdown", ensureAudio, true);
  host.addEventListener("keydown", ensureAudio, true);
  return {
    element: host,
    /** Add a button to the assistant's tools row. */
    addTool(element: HTMLElement) {
      toolsRow?.prepend(element);
    },
    /** Show a caption (e.g. a live video caption) in the sign-language box. */
    showCaption(text: string, lang: string) {
      signBox?.play(text, lang === "am" ? "am" : "en");
    },
    /** Post a MELA message in the conversation. */
    say(text: string) {
      if (options.assistant) bubble("mela", text);
      else output.textContent = text;
    },
    getLanguage: () => language,
    /** Start (or stop) talking, as if the Talk button was pressed. */
    talk() {
      details.open = true;
      ensureAudio();
      stopSpeech();
      voice.toggle();
    },
    makeButton: (label: string, fn: () => unknown) => b(label, fn),
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
      stopSpeech();
      void audioContext?.close();
      jarvis = false;
      stopSpeech();
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

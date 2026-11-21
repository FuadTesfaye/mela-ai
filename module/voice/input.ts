import type { Language } from "../../lib/types";
import { languages } from "../../lib/languages";
type Result = { isFinal?: boolean; 0: { transcript: string } };
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult:
    | ((e: { resultIndex?: number; results: ArrayLike<Result> }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort?: () => void;
}
const messages = {
  en: {
    start: "Starting microphone…",
    listen: "Listening… Speak, then stop or wait for a pause.",
    stop: "Stop microphone",
    ready: "Transcript ready. Edit it, then select Send.",
    none: "No speech heard. Please try again.",
    blocked:
      "Microphone permission was denied. Allow microphone access in your browser’s site settings, then retry.",
    device: "No microphone is available. Check your device and retry.",
    network:
      "Browser dictation is unavailable. Click the microphone again to record with Gemini.",
    unsupported:
      "Voice input is unavailable in this browser. Please type your question.",
    secure: "Microphone access requires HTTPS or localhost.",
    record:
      "Recording… Select Stop microphone when finished. Maximum 45 seconds.",
    process: "Transcribing recording…",
    cancel: "Cancel transcription",
    cancelled: "Voice input cancelled.",
    failed:
      "Transcription is unavailable. Your draft is unchanged; retry or type your question.",
    limit: "The recording is too large. Try a shorter question.",
    warning:
      "Your browser may send speech to its recognition service. Start microphone?",
    relay:
      "Record your voice and send the audio to Gemini for transcription? The recording is not saved on our server. You can edit the transcript before sending your question.",
    use: "Use microphone",
  },
  am: {
    start: "ማይክሮፎኑ እየተከፈተ ነው…",
    listen: "እየሰማሁ ነው… ይናገሩ፣ ከዚያ ያቁሙ ወይም ለአፍታ ዝም ይበሉ።",
    stop: "ማይክሮፎኑን አቁም",
    ready: "የተነገረው ጽሑፍ ዝግጁ ነው። ያርሙትና ላክ ይምረጡ።",
    none: "ንግግር አልተሰማም። እንደገና ይሞክሩ።",
    blocked: "የማይክሮፎን ፈቃድ ተከልክሏል። በአሳሹ የዚህ ጣቢያ ቅንብር ፈቃድ ሰጥተው ደግመው ይሞክሩ።",
    device: "ማይክሮፎን አልተገኘም። መሣሪያዎን ያረጋግጡ።",
    network: "የአሳሹ የድምፅ ግቤት አይገኝም። ቀርጾ በGemini ለማስጻፍ ማይክሮፎኑን ደግመው ይጫኑ።",
    unsupported: "በዚህ አሳሽ የድምፅ ግቤት አይገኝም። ጥያቄዎን ይጻፉ።",
    secure: "ማይክሮፎን ለመጠቀም HTTPS ወይም localhost ያስፈልጋል።",
    record: "እየተቀረጸ ነው… ሲጨርሱ ማይክሮፎኑን አቁም ይምረጡ። ከፍተኛው 45 ሰከንድ ነው።",
    process: "ድምፁ ወደ ጽሑፍ እየተቀየረ ነው…",
    cancel: "ወደ ጽሑፍ መቀየሩን ሰርዝ",
    cancelled: "የድምፅ ግቤቱ ተሰርዟል።",
    failed: "ድምፁን መጻፍ አልተቻለም። የእርስዎ ረቂቅ አልተቀየረም። ደግመው ይሞክሩ ወይም ይጻፉ።",
    limit: "ቅጂው በጣም ትልቅ ነው። አጭር ጥያቄ ይሞክሩ።",
    warning: "አሳሽዎ ድምፅዎን ወደ ድምፅ አገልግሎት ሊልክ ይችላል። ይጀምሩ?",
    relay:
      "ድምፅዎን ቀርጾ ወደ ጽሑፍ ለመቀየር ለGemini መላክ ይፈልጋሉ? ቅጂው በአገልጋያችን አይቀመጥም። ጥያቄዎን ከመላክዎ በፊት ጽሑፉን ማረም ይችላሉ።",
    use: "ማይክሮፎን ይጠቀሙ",
  },
};
export function create(options: {
  input: HTMLTextAreaElement;
  button: HTMLButtonElement;
  language: () => Language;
  status: (text: string, error?: boolean) => void;
  api: string;
  /** Called with the finished transcript, e.g. to send it automatically. */
  onFinal?: (text: string) => void;
  /** Called when native listening ends: heard speech, silence, or an error. */
  onEnd?: (outcome: "heard" | "none" | "error") => void;
  /** Skip the browser-dictation privacy prompt (already accepted, e.g. hands-free mode). */
  skipWarning?: () => boolean;
  /** Assistant mode: switch to Gemini transcription automatically when the
   * browser's dictation is unavailable (e.g. Brave, Linux Chromium) and stop
   * recording by itself when the speaker goes quiet. */
  autoMode?: boolean;
  /** Button label while idle (defaults to "Use microphone"). */
  useLabel?: string;
  /** Observe microphone state (e.g. to show a "listening" indicator). */
  onState?: (
    state: "idle" | "starting" | "listening" | "recording" | "processing",
  ) => void;
  /** Optional transcription relay (the extension routes audio through its worker). */
  transcribe?: (
    audio: string,
    mimeType: string,
    language: Language,
  ) => Promise<string>;
}) {
  const { input, button } = options;
  let recognition: Recognition | undefined,
    recorder: MediaRecorder | undefined,
    stream: MediaStream | undefined,
    request: AbortController | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let state: "idle" | "starting" | "listening" | "recording" | "processing" =
      "idle",
    disposed = false,
    session = 0,
    fallback = false,
    base = "",
    written = "",
    writing = false,
    heard = false,
    hadError = false,
    switching = false,
    relayOk = false,
    nativeOk = false;
  // Assistant mode records and transcribes with Gemini: browser dictation is
  // missing or silently broken in Brave, Linux Chromium builds and headless runs.
  if (options.autoMode) fallback = true;
  const t = () => messages[options.language() === "am" ? "am" : "en"];
  const active = () => !disposed && input.isConnected && button.isConnected;
  function setState(value: typeof state) {
    state = value;
    options.onState?.(value);
    if (!active()) return;
    const label =
      value === "idle"
        ? options.useLabel || t().use
        : value === "processing"
          ? t().cancel
          : t().stop;
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute(
      "aria-pressed",
      String(
        value === "listening" || value === "recording" || value === "starting",
      ),
    );
    button.setAttribute("aria-busy", String(value === "processing"));
    button.dataset.voiceState = value;
    button.classList.toggle("mic-active", value !== "idle");
  }
  function tracks() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
    clearTimeout(timer);
    timer = undefined;
  }
  function write(text: string) {
    if (!active() || input.value !== written) return;
    const next = [base.trim(), text.trim()]
      .filter(Boolean)
      .join(" ")
      .slice(0, input.maxLength > 0 ? input.maxLength : 2000);
    writing = true;
    input.value = written = next;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    writing = false;
  }
  function cancel() {
    session++;
    request?.abort();
    request = undefined;
    recognition?.abort?.();
    recognition = undefined;
    if (recorder?.state === "recording") recorder.stop();
    recorder = undefined;
    tracks();
    setState("idle");
  }
  const edited = () => {
    if (!writing && state !== "idle") {
      cancel();
      if (active()) options.status(t().cancelled);
    }
  };
  input.addEventListener("input", edited);
  const hidden = () => {
    if (document.visibilityState === "hidden") cancel();
  };
  document.addEventListener("visibilitychange", hidden);
  function error(reason: string) {
    hadError = true;
    setState("idle");
    if (!active()) return;
    options.status(
      reason === "not-allowed" || reason === "service-not-allowed"
        ? t().blocked
        : reason === "audio-capture"
          ? t().device
          : reason === "no-speech"
            ? t().none
            : reason === "aborted"
              ? t().cancelled
              : t().network,
      true,
    );
    if (["network", "language-not-supported"].includes(reason)) fallback = true;
  }
  /** Stop automatically ~1.3 s after the speaker goes quiet (or after 8 s of silence). */
  function listenForSilence(
    source: MediaStream,
    id: number,
    done: (heardSpeech: boolean) => void,
  ) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    let context: AudioContext;
    try {
      context = new AC();
    } catch {
      return;
    }
    void context.resume?.();
    // Without a user gesture (e.g. launched from a PWA shortcut) audio analysis
    // stays suspended: then stop after a fixed 7 s instead.
    setTimeout(() => {
      if (
        context.state !== "running" &&
        session === id &&
        state === "recording"
      ) {
        clearInterval(tick);
        void context.close();
        setTimeout(() => session === id && done(true), 6500);
      }
    }, 500);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(source).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    const began = Date.now();
    let first = 0,
      lastVoice = 0;
    const tick = setInterval(() => {
      if (session !== id || state !== "recording") {
        clearInterval(tick);
        void context.close();
        return;
      }
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      const now = Date.now();
      if (Math.sqrt(sum / data.length) > 0.02) {
        lastVoice = now;
        if (!first) first = now;
      }
      const finished =
        (first && now - lastVoice > 1300) || (!first && now - began > 8000);
      if (finished) {
        clearInterval(tick);
        void context.close();
        done(!!first);
      }
    }, 100);
  }
  async function record(id: number) {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setState("idle");
      options.status(t().unsupported, true);
      return;
    }
    if (!relayOk && !options.skipWarning?.() && !window.confirm(t().relay)) {
      setState("idle");
      options.onEnd?.("error");
      return;
    }
    relayOk = true;
    setState("starting");
    options.status(t().start);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (!active() || id !== session) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = acquired;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((value) => MediaRecorder.isTypeSupported(value));
      const capture = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined,
      );
      recorder = capture;
      const chunks: Blob[] = [];
      let size = 0;
      capture.ondataavailable = (e) => {
        if (session !== id) return;
        if (e.data.size) {
          chunks.push(e.data);
          size += e.data.size;
          if (size > 2000000) {
            cancel();
            options.status(t().limit, true);
          }
        }
      };
      capture.onerror = () => {
        if (session !== id) return;
        cancel();
        if (active()) options.status(t().failed, true);
      };
      capture.onstop = async () => {
        if (stream === acquired) tracks();
        else acquired.getTracks().forEach((track) => track.stop());
        if (!active() || session !== id) return;
        recorder = undefined;
        const blob = new Blob(chunks, {
          type: capture.mimeType.split(";")[0] || "audio/webm",
        });
        if (!blob.size || blob.size > 2000000 || silent) {
          setState("idle");
          options.status(blob.size > 2000000 ? t().limit : t().none, true);
          options.onEnd?.("none");
          return;
        }
        setState("processing");
        options.status(t().process);
        request = new AbortController();
        try {
          const audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          const value = options.transcribe
            ? {
                text: await options.transcribe(
                  audio,
                  blob.type,
                  options.language(),
                ),
              }
            : await (async () => {
                const response = await fetch(options.api + "/speech", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    language: options.language(),
                    mimeType: blob.type,
                    audio,
                    consent: true,
                  }),
                  signal: AbortSignal.any([
                    request.signal,
                    AbortSignal.timeout(50000),
                  ]),
                });
                if (!response.ok) throw new Error("speech");
                return response.json();
              })();
          if (!active() || session !== id) return;
          if (typeof value.text !== "string" || value.text.length > 2000)
            throw new Error("speech");
          let outcome: "heard" | "none" = "none";
          if (value.text.trim()) {
            write(value.text);
            options.status(t().ready);
            input.focus();
            outcome = "heard";
          } else options.status(t().none);
          if (session === id) {
            request = undefined;
            setState("idle");
          }
          if (outcome === "heard") options.onFinal?.(input.value);
          options.onEnd?.(outcome);
        } catch {
          if (active() && session === id) {
            options.status(t().failed, true);
            options.onEnd?.("error");
          }
        } finally {
          if (session === id) {
            request = undefined;
            setState("idle");
          }
        }
      };
      let silent = false;
      capture.start(250);
      setState("recording");
      options.status(options.autoMode ? t().listen : t().record);
      if (options.autoMode)
        listenForSilence(acquired, id, (heardSpeech) => {
          silent = !heardSpeech;
          if (capture.state === "recording") capture.stop();
        });
      timer = setTimeout(
        () => capture.state === "recording" && capture.stop(),
        45000,
      );
    } catch (e) {
      if (session === id) tracks();
      if (session === id && active()) {
        setState("idle");
        const name = (e as Error).name;
        options.status(
          name === "NotAllowedError"
            ? t().blocked
            : name === "NotFoundError"
              ? t().device
              : t().failed,
          true,
        );
      }
    }
  }
  function toggle() {
    if (!active()) return;
    if (state === "recording") {
      recorder?.stop();
      return;
    }
    if (state === "listening") {
      recognition?.stop();
      return;
    }
    if (state !== "idle") {
      cancel();
      options.status(t().cancelled);
      return;
    }
    if (window.isSecureContext === false) {
      options.status(t().secure, true);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Native = win.SpeechRecognition || win.webkitSpeechRecognition;
    const id = ++session;
    base = written = input.value;
    heard = false;
    hadError = false;
    if (!Native || fallback) {
      void record(id);
      return;
    }
    if (!nativeOk && !options.skipWarning?.() && !window.confirm(t().warning))
      return;
    nativeOk = true;
    let engine: Recognition;
    try {
      engine = new Native();
    } catch {
      error("network");
      return;
    }
    recognition = engine;
    engine.lang = languages[options.language()].speech;
    engine.continuous = false;
    engine.interimResults = true;
    engine.maxAlternatives = 1;
    setState("starting");
    options.status(t().start);
    engine.onstart = () => {
      if (active() && id === session) {
        setState("listening");
        options.status(t().listen);
      }
    };
    engine.onresult = (e) => {
      if (!active() || session !== id) return;
      const text = Array.from(e.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ");
      heard = !!text.trim();
      write(text);
    };
    engine.onerror = (e) => {
      if (!active() || session !== id) return;
      if (
        options.autoMode &&
        ["network", "language-not-supported", "service-not-allowed"].includes(
          e.error,
        )
      ) {
        // Browser dictation is unavailable here: record and transcribe with Gemini instead.
        fallback = true;
        switching = true;
        return;
      }
      error(e.error);
    };
    engine.onend = () => {
      if (switching && active() && id === session) {
        switching = false;
        recognition = undefined;
        void record(id);
        return;
      }
      if (active() && id === session) {
        recognition = undefined;
        setState("idle");
        if (!hadError) options.status(heard ? t().ready : t().none);
        if (!hadError && heard) options.onFinal?.(input.value);
        options.onEnd?.(hadError ? "error" : heard ? "heard" : "none");
      }
    };
    try {
      engine.start();
    } catch (e) {
      recognition = undefined;
      error(
        (e as Error).name === "NotAllowedError" ? "not-allowed" : "network",
      );
    }
  }
  setState("idle");
  return {
    toggle,
    cancel,
    idle: () => state === "idle",
    stop() {
      cancel();
      disposed = true;
      input.removeEventListener("input", edited);
      document.removeEventListener("visibilitychange", hidden);
    },
  };
}

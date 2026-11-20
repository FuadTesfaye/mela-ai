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
    hadError = false;
  const t = () => messages[options.language() === "am" ? "am" : "en"];
  const active = () => !disposed && input.isConnected && button.isConnected;
  function setState(value: typeof state) {
    state = value;
    if (!active()) return;
    const label =
      value === "idle"
        ? t().use
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
  async function record(id: number) {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setState("idle");
      options.status(t().unsupported, true);
      return;
    }
    if (!window.confirm(t().relay)) {
      setState("idle");
      return;
    }
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
        if (!blob.size || blob.size > 2000000) {
          setState("idle");
          options.status(blob.size ? t().limit : t().none, true);
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
          const value = await response.json();
          if (!active() || session !== id) return;
          if (typeof value.text !== "string" || value.text.length > 2000)
            throw new Error("speech");
          if (value.text.trim()) {
            write(value.text);
            options.status(t().ready);
            input.focus();
          } else options.status(t().none);
        } catch {
          if (active() && session === id) options.status(t().failed, true);
        } finally {
          if (session === id) {
            request = undefined;
            setState("idle");
          }
        }
      };
      capture.start(250);
      setState("recording");
      options.status(t().record);
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
    if (!window.confirm(t().warning)) return;
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
      if (active() && session === id) error(e.error);
    };
    engine.onend = () => {
      if (active() && id === session) {
        recognition = undefined;
        setState("idle");
        if (!hadError) options.status(heard ? t().ready : t().none);
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
    stop() {
      cancel();
      disposed = true;
      input.removeEventListener("input", edited);
      document.removeEventListener("visibilitychange", hidden);
    },
  };
}

/** Live, translated captions for YouTube (Deaf and other-language viewers).
 * 1. Turns on YouTube's own captions and reads them as they appear, or
 * 2. if the video has none, transcribes the video's audio in short chunks.
 * Each caption is translated into the viewer's language, shown large over the
 * video and passed to the sign-language box. */
type Ai = <T>(message: Record<string, unknown>) => Promise<T>;

export const isYouTubeVideo = () =>
  /(^|\.)youtube\.com$/.test(location.hostname) &&
  /^\/(watch|shorts|live)/.test(location.pathname);

export function youtubeLiveCaptions(options: {
  ai: Ai;
  language: () => string;
  onCaption: (text: string, language: string) => void;
  status: (message: string) => void;
}) {
  let active = false,
    observer: MutationObserver | undefined,
    lastWords: string[] = [],
    buffer: string[] = [],
    flushTimer: ReturnType<typeof setTimeout> | undefined,
    audioTimer: ReturnType<typeof setTimeout> | undefined,
    recorder: MediaRecorder | undefined,
    sawCaptions = false,
    sequence = 0,
    shown = 0;
  const transcript: string[] = [];

  // Large translated subtitles over the player (closed shadow root, no page styles).
  const host = document.createElement("div");
  host.setAttribute("data-mela-actions-ui", "");
  host.style.cssText =
    "position:absolute;left:0;right:0;bottom:11%;z-index:70;display:flex;justify-content:center;pointer-events:none";
  const shadow = host.attachShadow({ mode: "closed" });
  const line = document.createElement("div");
  shadow.append(
    Object.assign(document.createElement("style"), {
      textContent:
        "div{max-width:82%;padding:10px 18px;border-radius:10px;background:#000c;color:#fff;font:600 clamp(18px,2.6vw,34px)/1.35 system-ui,'Noto Sans Ethiopic',sans-serif;text-align:center;text-shadow:0 1px 2px #000}div:empty{display:none}",
    }),
    line,
  );
  // Hide YouTube's own caption window while ours is showing (same text, translated).
  const hideNative = document.createElement("style");
  hideNative.textContent = ".ytp-caption-window-container{opacity:0!important}";

  const show = (text: string, language: string, id: number) => {
    if (!active || id < shown) return;
    shown = id;
    line.textContent = text;
    options.onCaption(text, language);
  };
  const translate = (text: string) => {
    const id = ++sequence;
    transcript.push(text);
    if (transcript.length > 400) transcript.shift();
    const language = options.language();
    if (language === "en") return show(text, language, id);
    options
      .ai<string>({
        type: "mela:translate",
        text,
        language,
        context: transcript.slice(-3, -1).join(" "),
      })
      .then((translated) => show(translated || text, language, id))
      .catch(() => show(text, "en", id));
  };
  const flush = () => {
    clearTimeout(flushTimer);
    const text = buffer.join(" ").trim();
    buffer = [];
    if (text) translate(text);
  };

  // YouTube rolls caption lines; keep only the newly added words.
  const readCaptions = () => {
    const text = Array.from(document.querySelectorAll(".ytp-caption-segment"))
      .map((s) => s.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return;
    sawCaptions = true;
    const words = text.split(" ");
    let overlap = 0;
    for (let k = Math.min(words.length, lastWords.length); k > 0; k--)
      if (lastWords.slice(-k).join(" ") === words.slice(0, k).join(" ")) {
        overlap = k;
        break;
      }
    const added = words.slice(overlap);
    lastWords = words;
    if (!added.length) return;
    buffer.push(...added);
    clearTimeout(flushTimer);
    if (/[.!?]$/.test(added[added.length - 1]) || buffer.length >= 14) flush();
    else flushTimer = setTimeout(flush, 1600);
  };

  const video = () =>
    document.querySelector<HTMLVideoElement>("#movie_player video, video");

  // Fallback for videos without captions: transcribe the video's own audio.
  const listenToAudio = () => {
    const element = video() as
      | (HTMLVideoElement & { captureStream?: () => MediaStream })
      | null;
    const tracks = element?.captureStream?.().getAudioTracks() || [];
    if (!tracks.length) {
      options.status("This video has no captions and its audio can't be read.");
      return;
    }
    options.status("No captions on this video — transcribing its audio live.");
    const stream = new MediaStream(tracks);
    const chunk = () => {
      if (!active || sawCaptions) return;
      const parts: Blob[] = [];
      const rec = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      recorder = rec;
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = async () => {
        chunk(); // keep recording while the last chunk is transcribed
        if (element?.paused || !parts.length) return;
        const blob = new Blob(parts, { type: "audio/webm" });
        const audio = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result).split(",")[1] || "");
          reader.readAsDataURL(blob);
        });
        try {
          const text = await options.ai<string>({
            type: "mela:transcribe",
            audio,
            mimeType: "audio/webm",
            language: "auto",
          });
          if (text.trim() && active) translate(text.trim());
        } catch {
          /* skip this chunk */
        }
      };
      rec.start();
      setTimeout(() => rec.state === "recording" && rec.stop(), 6000);
    };
    chunk();
  };

  const reset = () => {
    lastWords = [];
    buffer = [];
    line.textContent = "";
  };
  const navigate = () => {
    reset();
    if (active) setTimeout(enableNative, 1500);
  };
  const enableNative = () => {
    const button = document.querySelector<HTMLButtonElement>(
      ".ytp-subtitles-button",
    );
    if (button?.getAttribute("aria-pressed") === "false") button.click();
  };

  return {
    get active() {
      return active;
    },
    transcript: () => transcript.join(" ").slice(-6000),
    start() {
      if (active || !isYouTubeVideo()) return false;
      active = true;
      sawCaptions = false;
      reset();
      const player = document.querySelector("#movie_player") || document.body;
      player.append(host);
      document.head.append(hideNative);
      enableNative();
      observer = new MutationObserver(readCaptions);
      observer.observe(player, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      document.addEventListener("yt-navigate-finish", navigate);
      audioTimer = setTimeout(() => {
        if (active && !sawCaptions) listenToAudio();
      }, 6000);
      return true;
    },
    stop() {
      active = false;
      observer?.disconnect();
      clearTimeout(flushTimer);
      clearTimeout(audioTimer);
      if (recorder?.state === "recording") recorder.stop();
      host.remove();
      hideNative.remove();
      document.removeEventListener("yt-navigate-finish", navigate);
    },
  };
}

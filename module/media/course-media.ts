import { youtubeId, youtubeUrl } from "../../lib/media/youtube";
import { youtubeAPI, type YouTubePlayer } from "./youtube-player";
import { transcriptRevision } from "../../lib/media/video-context";
import type { Transcript } from "../../lib/media/transcript";
const make = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
type Sign = {
  url: string;
  videoId: string;
  language: string;
  reviewer: string;
  offsetSeconds: number;
};
class CourseMedia extends HTMLElement {
  private root!: ShadowRoot;
  private player?: YouTubePlayer;
  private timer?: ReturnType<typeof setInterval>;
  private controller?: AbortController;
  private sign?: Sign;
  private signVideo?: HTMLVideoElement;
  private configurationVersion = 0;
  private configurationController?: AbortController;
  private signingDialog?: HTMLDialogElement;
  private closeSigningDialog?: (focus?: boolean) => void;
  private signingReady = false;
  private signingFailed = false;
  private signingBlocked = false;
  private signingPlayPending?: HTMLVideoElement;
  private signingMessage?: HTMLElement;
  private signingAction?: HTMLButtonElement;
  private videoUrl = "https://www.youtube.com/watch?v=9hE5-98ZeCg";
  private lastTick = -1;
  private frame?: HTMLIFrameElement;
  private status!: HTMLParagraphElement;
  private transcript?: Transcript;
  private requestVersion = 0;
  connectedCallback() {
    if (this.root) return;
    this.root = this.attachShadow({ mode: "open" });
    this.render();
    void this.configuration();
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.configurationVersion++;
    this.configurationController?.abort();
    this.clearSigning();
    clearInterval(this.timer);
    this.player?.destroy();
    this.signVideo?.pause();
  }
  private render() {
    const style = make("style");
    style.textContent = `:host{display:block;font:14px/1.6 Arial,sans-serif;color:#17394e}*{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit}button{cursor:pointer;padding:10px 13px;border:1px solid #b5cbd8;border-radius:5px;background:#fff;color:#16445e}button:hover{background:#edf8fc}button:disabled{opacity:.6;cursor:wait}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #cc940c;outline-offset:3px}.card{border:1px solid #cfdee7;border-radius:9px;overflow:hidden;background:white}.bar{display:flex;align-items:center;gap:12px;background:#eef7fb;padding:16px 18px}.bar strong{font-size:16px}.badge{font-size:11px;margin-left:auto;background:white;border:1px solid #c7dce7;border-radius:20px;padding:4px 9px}.body{padding:18px}.url-form{display:flex;gap:8px;margin-bottom:12px}.url-form input{padding:10px;border:1px solid #adc2cf;border-radius:5px;flex:1;min-width:0}.stage{background:#062c40;aspect-ratio:16/9;min-height:220px;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:6px}.stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.placeholder{text-align:center;color:#fff;padding:20px}.placeholder strong{display:block;font-size:19px}.placeholder p{font-size:13px;color:#cfdfeb;max-width:330px}.player-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}.player-layout.with-signing{grid-template-columns:minmax(0,1fr) 180px}.sign-box{width:180px;background:#f7fafc;border:1px solid #b8d2df;border-radius:7px;overflow:hidden;color:#355a70;animation:sign-open 150ms ease-out}.sign-label{font-size:11px;font-weight:bold;letter-spacing:.5px;background:#003c54;color:white;padding:8px}.sign-placeholder,.sign-status{margin:0;padding:10px;font-size:12px;line-height:1.5}.sign-viewport{aspect-ratio:1;background:#182e3e;display:grid;place-items:center}.sign-viewport video{width:100%;height:100%;min-height:0;object-fit:contain;aspect-ratio:1}.sign-action,.expand-sign{margin:0 8px 9px;font-size:12px;padding:7px}.sign-dialog{width:min(640px,95vw);max-height:90vh;overflow:auto;padding:16px;border:2px solid #006b89;border-radius:8px;color:#17394e}.sign-dialog::backdrop{background:#00192799}.sign-dialog h3{margin:0 0 12px;font-size:17px}.sign-dialog .sign-viewport{margin-top:12px;aspect-ratio:auto}.sign-dialog video{max-height:65vh;aspect-ratio:auto}.sign-dialog .sign-status{font-size:14px}@keyframes sign-open{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.sign-box{animation:none}}.controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:13px}.primary{background:#006b89;color:white;border-color:#006b89}.controls label{display:flex;align-items:center;gap:7px;font-size:12px}.controls input{width:17px;height:17px}.status{font-size:12px;color:#3b5f75;margin:12px 0 0;min-height:20px}.transcript{margin-top:18px;border-top:1px solid #dce6ed;padding-top:15px}.transcript h3{font-size:16px;margin:0 0 7px}.transcript small{display:block;font-size:12px;color:#5b6f7c}.cues{max-height:300px;overflow:auto;margin-top:12px}.cue{width:100%;text-align:left;display:flex;align-items:baseline;gap:12px;border:0;border-top:1px solid #e8eff4;border-radius:0;padding:11px 5px;background:white;font-size:13px}.cue.active{background:#eaf7fc}.time{font-weight:bold;white-space:nowrap;color:#006580;font-size:11px}.download{font-size:12px;color:#005d7b;text-decoration:underline;margin-left:auto}@media(max-width:650px){.player-layout.with-signing{grid-template-columns:minmax(0,1fr)}.sign-box{width:min(220px,100%)}.url-form{flex-wrap:wrap}.url-form input{flex-basis:100%}.bar{padding:12px}.body{padding:12px}.bar strong{font-size:14px}.badge{font-size:10px}.placeholder strong{font-size:15px}.placeholder p{font-size:11px;max-width:190px}.stage{min-height:230px}.controls label{font-size:11px}}`;
    const card = make("section", undefined, "card");
    card.setAttribute(
      "aria-label",
      "English course video and accessibility support",
    );
    const bar = make("div", undefined, "bar");
    bar.append(
      make("strong", "Course video & transcript"),
      make("span", "ENGLISH", "badge"),
    );
    const body = make("div", undefined, "body");
    const form = make("form", undefined, "url-form");
    const input = make("input");
    input.type = "url";
    input.value = this.videoUrl;
    input.required = true;
    input.setAttribute("aria-label", "Public YouTube course video URL");
    const load = make("button", "Load YouTube video");
    load.type = "submit";
    form.append(input, load);
    form.onsubmit = (e) => {
      e.preventDefault();
      void this.load(input.value);
    };
    const stage = make("div", undefined, "stage");
    const placeholder = make("div", undefined, "placeholder");
    placeholder.append(
      make("strong", "Watch. Read. Ask about it."),
      make(
        "p",
        "Load this example or paste a public YouTube lesson. YouTube connects only when you load the video.",
      ),
    );
    stage.append(placeholder);
    const sign = make("div", undefined, "sign-box");
    sign.id = "signing-panel";
    sign.hidden = true;
    sign.setAttribute("role", "group");
    sign.setAttribute("aria-label", "Ethiopian Sign Language panel");
    sign.append(
      make("div", "SIGN LANGUAGE · EthSL", "sign-label"),
      make("div", "Checking EthSL interpretation…", "sign-placeholder"),
    );
    const layout = make("div", undefined, "player-layout");
    layout.append(stage, sign);
    const controls = make("div", undefined, "controls");
    const consent = make("label");
    const check = make("input");
    check.type = "checkbox";
    consent.append(
      check,
      document.createTextNode(
        "Share this public video with Gemini for an English transcript",
      ),
    );
    const transcribe = make("button", "Generate English transcript", "primary");
    transcribe.type = "button";
    transcribe.onclick = async () => {
      if (!check.checked) {
        this.status.textContent =
          "Select the sharing choice before sending the video to Gemini.";
        check.focus();
        return;
      }
      try {
        const requested = youtubeUrl(input.value);
        if (!this.frame || requested !== this.videoUrl) {
          await this.load(requested);
          if (requested !== this.videoUrl) return;
        }
        transcribe.disabled = true;
        await this.generate();
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        )
          return;
        this.status.textContent =
          error instanceof Error
            ? error.message
            : "Could not transcribe this video.";
      } finally {
        transcribe.disabled = false;
      }
    };
    const toggle = make("button", "Show signing panel", "sign-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", sign.id);
    toggle.onclick = () => {
      sign.hidden = !sign.hidden;
      toggle.textContent = sign.hidden
        ? "Show signing panel"
        : "Hide signing panel";
      toggle.setAttribute("aria-expanded", String(!sign.hidden));
      layout.classList.toggle("with-signing", !sign.hidden);
      if (sign.hidden) {
        this.closeSigningDialog?.(false);
        this.signVideo?.pause();
      } else {
        if (!this.signVideo && this.sign) this.showSigning();
        this.synchronize();
      }
    };
    const explain = make("button", "Explain this moment");
    explain.type = "button";
    explain.onclick = () => {
      if (!this.transcript) {
        this.status.textContent =
          "Generate or restore this video's transcript first.";
        return;
      }
      this.player?.pauseVideo?.();
      this.dispatchEvent(
        new CustomEvent("mela:explain-moment", {
          bubbles: true,
          composed: true,
          detail: { video: this.snapshot(), cues: this.transcript.cues },
        }),
      );
    };
    controls.append(consent, transcribe, toggle, explain);
    this.status = make(
      "p",
      "Example video; replace it with your course video. Signing is enabled only for a matching, reviewed EthSL clip.",
      "status",
    );
    this.status.setAttribute("role", "status");
    body.append(form, layout, controls, this.status);
    card.append(bar, body);
    this.root.append(style, card);
  }
  private async configuration() {
    const version = ++this.configurationVersion;
    this.configurationController?.abort();
    this.configurationController = new AbortController();
    const source = this.videoUrl;
    try {
      const response = await fetch(
        `/api/v1/lessons/${encodeURIComponent(this.getAttribute("lesson-id") || "va-future")}/media${this.frame ? "?videoId=" + youtubeId(source) : ""}`,
        { signal: this.configurationController.signal },
      );
      if (version !== this.configurationVersion || !this.isConnected) return;
      if (!response.ok)
        throw new Error("Signing availability could not be checked.");
      const config = await response.json();
      if (
        version !== this.configurationVersion ||
        source !== this.videoUrl ||
        !this.isConnected
      )
        return;
      if (!this.frame && config.defaultVideoUrl) {
        this.videoUrl = youtubeUrl(config.defaultVideoUrl);
        this.root.querySelector<HTMLInputElement>(".url-form input")!.value =
          this.videoUrl;
      }
      this.sign =
        config.signLanguage?.videoId === youtubeId(this.videoUrl)
          ? config.signLanguage
          : undefined;
      this.showSigning();
      this.restoreTranscript();
      this.publishVideo();
    } catch {
      if (version !== this.configurationVersion || !this.isConnected) return;
      this.sign = undefined;
      this.showSigning(
        "Signing availability could not be checked. Try again.",
        true,
      );
      this.restoreTranscript();
      this.publishVideo();
    }
  }
  private restoreTranscript() {
    try {
      const data = JSON.parse(
        localStorage.getItem(
          "mela-video-transcript:" + youtubeId(this.videoUrl),
        ) || "null",
      );
      if (
        !data ||
        data.language !== "en" ||
        youtubeUrl(data.videoUrl) !== this.videoUrl ||
        !Array.isArray(data.cues) ||
        !data.cues.length ||
        data.cues.length > 240 ||
        data.cues.some(
          (c: { start: number; end: number; text: string }) =>
            typeof c.text !== "string" ||
            c.text.length > 1500 ||
            !Number.isFinite(c.start) ||
            !Number.isFinite(c.end) ||
            c.start < 0 ||
            c.end <= c.start,
        )
      )
        return;
      this.transcript = data;
      this.drawTranscript(data);
      this.dispatchTranscript(data.cues);
      this.status.textContent =
        "Saved English transcript restored. You can read it and ask MELA about it offline.";
    } catch {}
  }
  private async load(value: string) {
    let canonical: string;
    try {
      canonical = youtubeUrl(value);
    } catch (error) {
      this.status.textContent = (error as Error).message;
      return;
    }
    this.controller?.abort();
    this.requestVersion++;
    this.transcript = undefined;
    this.root.querySelector(".transcript")?.remove();
    this.dispatchTranscript([]);
    clearInterval(this.timer);
    this.player?.destroy();
    this.player = undefined;
    this.clearSigning();
    this.sign = undefined;
    this.videoUrl = canonical;
    this.root.querySelector("iframe")?.remove();
    this.root.querySelector(".placeholder")?.remove();
    const frame = make("iframe");
    frame.title = "Course video on YouTube";
    frame.allow =
      "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.src = `https://www.youtube-nocookie.com/embed/${youtubeId(canonical)}?enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(location.origin)}`;
    this.root.querySelector(".stage")!.prepend(frame);
    this.frame = frame;
    this.lastTick = -1;
    this.publishVideo();
    this.showSigning("Checking EthSL interpretation…");
    void this.configuration();
    this.restoreTranscript();
    this.status.textContent =
      "Video loaded. You can now generate its English transcript.";
    try {
      const api = await youtubeAPI();
      if (this.frame !== frame || !this.isConnected) return;
      this.player = new api.Player(frame, {
        events: {
          onReady: () => this.synchronize(),
          onStateChange: () => this.synchronize(),
        },
      });
      this.timer = setInterval(() => this.synchronize(), 350);
    } catch (error) {
      this.status.textContent = (error as Error).message;
    }
  }
  private clearSigning() {
    // Close first so the existing content is restored before it is discarded.
    this.closeSigningDialog?.(false);
    this.signVideo?.pause();
    this.signVideo?.remove();
    this.signVideo = undefined;
    this.signingReady = false;
    this.signingFailed = false;
    this.signingBlocked = false;
    this.signingPlayPending = undefined;
  }
  private signingState(message: string, action?: string) {
    if (this.signingMessage?.textContent !== message && this.signingMessage)
      this.signingMessage.textContent = message;
    if (this.signingAction) {
      this.signingAction.hidden = !action;
      this.signingAction.textContent = action || "";
    }
  }
  private showSigning(
    message = "EthSL interpretation is not available for this video yet.",
    retry = false,
  ) {
    this.clearSigning();
    const box = this.root.querySelector<HTMLElement>(".sign-box")!;
    box.querySelector(".sign-content")?.remove();
    box.querySelector(".sign-placeholder")?.remove();
    box.querySelector(".expand-sign")?.remove();
    const content = make("div", undefined, "sign-content");
    this.signingMessage = make("p", message, "sign-status");
    this.signingMessage.setAttribute("role", "status");
    this.signingMessage.setAttribute("aria-atomic", "true");
    this.signingAction = make("button", "Retry signing", "sign-action");
    this.signingAction.type = "button";
    this.signingAction.hidden = !retry;
    this.signingAction.onclick = () => void this.configuration();
    content.append(this.signingMessage, this.signingAction);
    box.append(content);
    if (!this.sign || this.sign.videoId !== youtubeId(this.videoUrl)) return;
    if (box.hidden) {
      this.signingState("Ready. Show the panel to load the interpreter.");
      return;
    }
    const video = make("video");
    this.signVideo = video;
    video.src = this.sign.url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute(
      "aria-label",
      `EthSL interpretation, reviewed by ${this.sign.reviewer}`,
    );
    const viewport = make("div", undefined, "sign-viewport");
    viewport.append(video);
    content.prepend(viewport);
    this.signingState("Loading interpreter…");
    const current = () => this.signVideo === video && this.isConnected;
    video.onloadedmetadata = () => {
      if (!current() || this.signingFailed) return;
      this.signingReady = true;
      this.signingState("Ready · play the lesson to begin.");
      this.synchronize();
    };
    video.oncanplay = () => {
      if (!current() || this.signingFailed) return;
      this.signingReady = video.readyState >= 1;
      if (this.signingReady)
        this.signingState("Ready · play the lesson to begin.");
      this.synchronize();
    };
    video.onwaiting = () => {
      if (current() && !this.signingFailed)
        this.signingState("Loading interpreter…");
    };
    video.onerror = () => {
      if (!current()) return;
      this.signingFailed = true;
      video.pause();
      this.signingState(
        "The interpreter recording could not be played.",
        "Retry signing",
      );
    };
    this.signingAction.onclick = () => {
      if (this.signingFailed) {
        this.showSigning();
        this.root.querySelector<HTMLButtonElement>(".expand-sign")?.focus();
        return;
      }
      this.signingBlocked = false;
      this.synchronize();
    };
    const expand = make("button", "Enlarge signing", "expand-sign");
    expand.type = "button";
    expand.onclick = () => {
      if (this.signingDialog) return;
      const dialog = make("dialog", undefined, "sign-dialog");
      this.signingDialog = dialog;
      const title = make("h3", "Ethiopian Sign Language interpretation");
      title.id = "signing-dialog-title";
      dialog.setAttribute("aria-labelledby", title.id);
      const close = make("button", "Close enlarged signing");
      close.type = "button";
      dialog.append(title, close, content);
      this.root.append(dialog);
      let closed = false;
      const finish = (focus = true) => {
        if (closed) return;
        closed = true;
        // Restore synchronously: the native close event is queued, and a new
        // source must never retain old media inside a still-visible dialog.
        dialog.close();
        expand.before(content);
        dialog.remove();
        if (this.signingDialog === dialog) {
          this.signingDialog = undefined;
          this.closeSigningDialog = undefined;
        }
        if (focus && expand.isConnected && !box.hidden) expand.focus();
      };
      this.closeSigningDialog = finish;
      dialog.addEventListener("close", () => finish(), { once: true });
      close.onclick = () => finish();
      dialog.showModal();
      close.focus();
    };
    box.append(expand);
  }
  private synchronize() {
    if (!this.player || typeof this.player.getCurrentTime !== "function")
      return;
    const seconds = this.player.getCurrentTime() || 0;
    if (Math.floor(seconds) !== this.lastTick) {
      this.lastTick = Math.floor(seconds);
      this.publishVideo();
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      ".cue",
    )) {
      button.classList.toggle(
        "active",
        seconds >= Number(button.dataset.start) &&
          seconds < Number(button.dataset.end),
      );
    }
    const video = this.signVideo;
    if (!video || !this.sign) return;
    if (this.root.querySelector<HTMLElement>(".sign-box")?.hidden) {
      video.pause();
      return;
    }
    if (this.signingFailed) return;
    if (!this.signingReady) {
      this.signingState("Loading interpreter…");
      return;
    }
    const target = Math.max(0, seconds - this.sign.offsetSeconds);
    if (Number.isFinite(video.duration) && target >= video.duration) {
      video.pause();
      this.signingState("Interpreter recording has ended.");
      return;
    }
    try {
      if (Math.abs(video.currentTime - target) > 0.5)
        video.currentTime = target;
      video.playbackRate = this.player.getPlaybackRate() || 1;
    } catch {
      this.signingState("Loading interpreter…");
      return;
    }
    const playing =
      this.player.getPlayerState() === 1 && seconds >= this.sign.offsetSeconds;
    if (!playing) {
      video.pause();
      this.signingState("Ready · follows lesson playback.");
      return;
    }
    if (this.signingBlocked) {
      this.signingState(
        "Your browser needs permission to start the interpreter.",
        "Start interpreter",
      );
      return;
    }
    if (this.signingPlayPending === video) return;
    if (!video.paused) {
      this.signingState(
        video.readyState < 3 ? "Loading interpreter…" : "Interpreting lesson.",
      );
      return;
    }
    this.signingPlayPending = video;
    // A rejected play promise must not trigger another request on every timer tick.
    try {
      Promise.resolve(video.play())
        .then(() => {
          if (
            this.signVideo !== video ||
            this.root.querySelector<HTMLElement>(".sign-box")?.hidden ||
            this.player?.getPlayerState() !== 1
          ) {
            video.pause();
            return;
          }
          this.signingState("Interpreting lesson.");
        })
        .catch((error: unknown) => {
          if (this.signVideo !== video) return;
          this.signingPlaybackError(error);
        })
        .finally(() => {
          if (this.signingPlayPending === video)
            this.signingPlayPending = undefined;
        });
    } catch (error) {
      this.signingPlayPending = undefined;
      this.signingPlaybackError(error);
    }
  }
  private signingPlaybackError(error: unknown) {
    const name =
      error && typeof error === "object" && "name" in error ? error.name : "";
    if (name === "AbortError") return;
    if (name === "NotAllowedError") {
      this.signingBlocked = true;
      this.signingState(
        "Your browser needs permission to start the interpreter.",
        "Start interpreter",
      );
    } else {
      this.signingFailed = true;
      this.signingState(
        "The interpreter recording could not be played.",
        "Retry signing",
      );
    }
  }

  private async generate() {
    const version = this.requestVersion;
    const videoUrl = this.videoUrl;
    this.controller = new AbortController();
    this.status.textContent =
      "Gemini is processing the video’s speech. This may take up to 90 seconds…";
    const response = await fetch("/api/v1/transcriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl, language: "en", consent: true }),
      signal: this.controller.signal,
    });
    const data = await response.json();
    if (version !== this.requestVersion || !this.isConnected) return;
    if (!response.ok)
      throw new Error(data.error || "Video transcription failed.");
    this.transcript = data;
    try {
      localStorage.setItem(
        "mela-video-transcript:" + youtubeId(videoUrl),
        JSON.stringify(data),
      );
    } catch {}
    this.drawTranscript(data);
    this.dispatchTranscript(data.cues);
    this.status.textContent =
      "English transcript ready. It is AI-generated; review it for accuracy. MELA can now use it as lesson context.";
  }
  private drawTranscript(data: Transcript) {
    this.root.querySelector(".transcript")?.remove();
    const section = make("div", undefined, "transcript");
    section.append(
      make("h3", "English transcript"),
      make(
        "small",
        "AI-generated from this video’s audio · review before relying on it",
      ),
    );
    const download = make("button", "Download transcript", "download");
    download.type = "button";
    download.onclick = () => {
      const text = data.cues
        .map((c) => `${this.time(c.start)} ${c.text}`)
        .join("\n");
      const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
      const link = make("a");
      link.href = url;
      link.download = "course-transcript-en.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    section.append(download);
    const cues = make("div", undefined, "cues");
    for (const cue of data.cues) {
      const button = make("button", undefined, "cue");
      button.type = "button";
      button.dataset.start = String(cue.start);
      button.dataset.end = String(cue.end);
      button.append(
        make("span", this.time(cue.start), "time"),
        make("span", cue.text),
      );
      button.onclick = () => {
        if (this.player) this.player.seekTo(cue.start, true);
        else
          this.frame?.contentWindow?.postMessage(
            JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [cue.start, true],
            }),
            "https://www.youtube-nocookie.com",
          );
      };
      cues.append(button);
    }
    section.append(cues);
    this.root.querySelector(".body")!.append(section);
  }
  private snapshot() {
    return {
      videoId: youtubeId(this.videoUrl),
      url: this.videoUrl,
      title: this.getAttribute("title") || "Course video",
      currentTime: Math.max(0, this.player?.getCurrentTime?.() || 0),
      duration: Math.max(0, this.player?.getDuration?.() || 0),
      transcriptRevision: this.transcript
        ? transcriptRevision(this.videoUrl, this.transcript.cues)
        : undefined,
    };
  }
  private publishVideo() {
    this.dispatchEvent(
      new CustomEvent("mela:video-state", {
        bubbles: true,
        composed: true,
        detail: this.snapshot(),
      }),
    );
  }
  private dispatchTranscript(
    cues: { start: number; end: number; text: string }[],
  ) {
    this.dispatchEvent(
      new CustomEvent("mela:transcript-ready", {
        bubbles: true,
        composed: true,
        detail: {
          videoUrl: this.videoUrl,
          language: "en",
          cues,
          video: this.snapshot(),
        },
      }),
    );
  }
  private time(value: number) {
    return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  }
}
if (!customElements.get("mela-course-media"))
  customElements.define("mela-course-media", CourseMedia);

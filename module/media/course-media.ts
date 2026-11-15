import { youtubeId, youtubeUrl } from "../../lib/media/youtube";
import { youtubeAPI, type YouTubePlayer } from "./youtube-player";
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
  private videoUrl = "https://www.youtube.com/watch?v=9hE5-98ZeCg";
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
    clearInterval(this.timer);
    this.player?.destroy();
    this.signVideo?.pause();
  }
  private render() {
    const style = make("style");
    style.textContent = `:host{display:block;font:14px/1.6 Arial,sans-serif;color:#17394e}*{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit}button{cursor:pointer;padding:10px 13px;border:1px solid #b5cbd8;border-radius:5px;background:#fff;color:#16445e}button:hover{background:#edf8fc}button:disabled{opacity:.6;cursor:wait}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #cc940c;outline-offset:3px}.card{border:1px solid #cfdee7;border-radius:9px;overflow:hidden;background:white}.bar{display:flex;align-items:center;gap:12px;background:#eef7fb;padding:16px 18px}.bar strong{font-size:16px}.badge{font-size:11px;margin-left:auto;background:white;border:1px solid #c7dce7;border-radius:20px;padding:4px 9px}.body{padding:18px}.url-form{display:flex;gap:8px;margin-bottom:12px}.url-form input{padding:10px;border:1px solid #adc2cf;border-radius:5px;flex:1;min-width:0}.stage{background:#062c40;aspect-ratio:16/9;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:6px}.stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.placeholder{text-align:center;color:#fff;padding:20px}.placeholder strong{display:block;font-size:19px}.placeholder p{font-size:13px;color:#cfdfeb;max-width:330px}.sign-box{position:absolute;right:12px;top:12px;width:155px;height:155px;z-index:2;background:#f7fafc;border:2px solid #fff;box-shadow:0 2px 14px #00192766;border-radius:6px;overflow:hidden;color:#355a70;display:flex;flex-direction:column}.sign-label{font-size:10px;font-weight:bold;letter-spacing:.7px;background:#003c54;color:white;padding:5px 8px}.sign-placeholder{padding:13px 9px;text-align:center;font-size:11px;flex:1;display:grid;place-items:center}.sign-box video{width:100%;height:calc(100% - 25px);object-fit:contain;background:#182e3e}.controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:13px}.primary{background:#006b89;color:white;border-color:#006b89}.controls label{display:flex;align-items:center;gap:7px;font-size:12px}.controls input{width:17px;height:17px}.status{font-size:12px;color:#3b5f75;margin:12px 0 0;min-height:20px}.transcript{margin-top:18px;border-top:1px solid #dce6ed;padding-top:15px}.transcript h3{font-size:16px;margin:0 0 7px}.transcript small{display:block;font-size:12px;color:#5b6f7c}.cues{max-height:300px;overflow:auto;margin-top:12px}.cue{width:100%;text-align:left;display:flex;align-items:baseline;gap:12px;border:0;border-top:1px solid #e8eff4;border-radius:0;padding:11px 5px;background:white;font-size:13px}.cue.active{background:#eaf7fc}.time{font-weight:bold;white-space:nowrap;color:#006580;font-size:11px}.download{font-size:12px;color:#005d7b;text-decoration:underline;margin-left:auto}@media(max-width:650px){.sign-box{width:112px;height:112px;right:7px;top:7px}.sign-placeholder{padding:6px;font-size:9px}.sign-label{font-size:9px;padding:3px 5px}.url-form{flex-wrap:wrap}.url-form input{flex-basis:100%}.bar{padding:12px}.body{padding:12px}.bar strong{font-size:14px}.badge{font-size:10px}.placeholder strong{font-size:15px}.placeholder p{font-size:11px;max-width:190px}.stage{min-height:230px}.controls label{font-size:11px}}`;
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
    sign.setAttribute("aria-label", "Ethiopian Sign Language panel");
    sign.append(
      make("div", "SIGN LANGUAGE · EthSL", "sign-label"),
      make(
        "div",
        "No validated signing video is connected to this lesson.",
        "sign-placeholder",
      ),
    );
    stage.append(sign);
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
    const toggle = make("button", "Hide signing panel");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "true");
    toggle.onclick = () => {
      sign.hidden = !sign.hidden;
      toggle.textContent = sign.hidden
        ? "Show signing panel"
        : "Hide signing panel";
      toggle.setAttribute("aria-expanded", String(!sign.hidden));
      if (sign.hidden) this.signVideo?.pause();
    };
    controls.append(consent, transcribe, toggle);
    this.status = make(
      "p",
      "Example video; replace it with your course video. Signing is enabled only for a matching, reviewed EthSL clip.",
      "status",
    );
    this.status.setAttribute("role", "status");
    body.append(form, stage, controls, this.status);
    card.append(bar, body);
    this.root.append(style, card);
  }
  private async configuration() {
    try {
      const response = await fetch(
        `/api/v1/lessons/${encodeURIComponent(this.getAttribute("lesson-id") || "va-future")}/media`,
      );
      if (!response.ok) return;
      const config = await response.json();
      this.sign = config.signLanguage || undefined;
      if (this.frame) this.showSigning();
      if (!this.frame && config.defaultVideoUrl) {
        this.videoUrl = youtubeUrl(config.defaultVideoUrl);
        this.root.querySelector<HTMLInputElement>(".url-form input")!.value =
          this.videoUrl;
      }
    } catch {
    } finally {
      this.restoreTranscript();
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
    this.signVideo?.pause();
    this.signVideo = undefined;
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
    this.showSigning();
    this.restoreTranscript();
    this.status.textContent =
      "Video loaded. You can now generate its English transcript.";
    try {
      const api = await youtubeAPI();
      if (this.frame !== frame) return;
      this.player = new api.Player(frame, {
        events: { onReady: () => {}, onStateChange: () => this.synchronize() },
      });
      this.timer = setInterval(() => this.synchronize(), 350);
    } catch (error) {
      this.status.textContent = (error as Error).message;
    }
  }
  private showSigning() {
    const box = this.root.querySelector(".sign-box")!;
    box.querySelector("video")?.remove();
    box.querySelector(".sign-placeholder")?.remove();
    if (this.sign?.videoId === youtubeId(this.videoUrl)) {
      const video = make("video");
      video.src = this.sign.url;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute(
        "aria-label",
        `Validated EthSL interpretation, reviewed by ${this.sign.reviewer}`,
      );
      box.append(video);
      this.signVideo = video;
      video.onerror = () => {
        video.remove();
        this.signVideo = undefined;
        box.append(
          make(
            "div",
            "The validated signing video could not be loaded.",
            "sign-placeholder",
          ),
        );
      };
    } else
      box.append(
        make(
          "div",
          "No validated signing video is connected to this lesson.",
          "sign-placeholder",
        ),
      );
  }
  private synchronize() {
    if (!this.player || typeof this.player.getCurrentTime !== "function")
      return;
    const seconds = this.player.getCurrentTime() || 0;
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      ".cue",
    )) {
      const start = Number(button.dataset.start),
        end = Number(button.dataset.end);
      button.classList.toggle("active", seconds >= start && seconds < end);
    }
    if (this.root.querySelector<HTMLElement>(".sign-box")?.hidden) {
      this.signVideo?.pause();
      return;
    }
    if (this.signVideo && this.sign) {
      const target = Math.max(0, seconds - this.sign.offsetSeconds);
      if (
        Number.isFinite(this.signVideo.duration) &&
        target >= this.signVideo.duration
      ) {
        this.signVideo.pause();
        return;
      }
      if (Math.abs(this.signVideo.currentTime - target) > 0.65)
        this.signVideo.currentTime = target;
      this.signVideo.playbackRate = this.player.getPlaybackRate() || 1;
      if (
        this.player.getPlayerState() === 1 &&
        seconds >= this.sign.offsetSeconds
      )
        void this.signVideo.play().catch(() => {});
      else this.signVideo.pause();
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
  private dispatchTranscript(
    cues: { start: number; end: number; text: string }[],
  ) {
    this.dispatchEvent(
      new CustomEvent("mela:transcript-ready", {
        bubbles: true,
        composed: true,
        detail: { videoUrl: this.videoUrl, language: "en", cues },
      }),
    );
  }
  private time(value: number) {
    return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  }
}
if (!customElements.get("mela-course-media"))
  customElements.define("mela-course-media", CourseMedia);

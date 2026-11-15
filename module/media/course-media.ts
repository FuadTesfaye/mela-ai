import { youtubeId, youtubeUrl } from "../../lib/media/youtube";
import { youtubeAPI, type YouTubePlayer } from "./youtube-player";
import { transcriptRevision } from "../../lib/media/video-context";
import { DEFAULT_LESSON_VIDEO } from "../../lib/media/lesson-catalog";
import { validTranscript } from "./transcript-client";
import { mountLearningPreview } from "./learning-preview";
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
  private playerReady = false;
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
  private videoUrl = DEFAULT_LESSON_VIDEO.videoUrl;
  private lastTick = -1;
  private frame?: HTMLIFrameElement;
  private status!: HTMLParagraphElement;
  private transcript?: Transcript;
  private requestVersion = 0;
  private learningPreview?: ReturnType<typeof mountLearningPreview>;
  private transcribing = false;
  private transcriptionError = "";
  connectedCallback() {
    if (this.root) return;
    const source = this.getAttribute("video-src");
    if (source) {
      try {
        this.videoUrl = youtubeUrl(source);
      } catch {}
    }
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
  static get observedAttributes() {
    return ["video-src", "renderer"];
  }
  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    value: string | null,
  ) {
    if (name === "renderer" && this.root && value !== oldValue) {
      this.learningPreview?.setRenderer(
        value === "2d" || value === "3d" ? value : "auto",
      );
      return;
    }
    if (name === "video-src" && this.root && value && value !== oldValue)
      void this.load(value);
  }
  private apiUrl(path: string) {
    return new URL(
      (this.getAttribute("api") || "/api").replace(/\/$/, "") + path,
      location.href,
    ).href;
  }
  private remoteUrl(path: string) {
    return new URL(path, new URL(this.apiUrl("/")).origin).href;
  }
  private render() {
    const style = make("style");
    style.textContent = `:host{display:block;font:14px/1.6 Arial,sans-serif;color:#17394e}*{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit}button{cursor:pointer;padding:10px 13px;border:1px solid #b5cbd8;border-radius:5px;background:#fff;color:#16445e}button:hover{background:#edf8fc}button:disabled{opacity:.6;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #cc940c;outline-offset:3px}.card{border:1px solid #cfdee7;border-radius:9px;overflow:hidden;background:white}.bar{display:flex;align-items:center;gap:12px;background:#eef7fb;padding:16px 18px}.bar strong{font-size:16px}.badge{font-size:11px;margin-left:auto;background:white;border:1px solid #c7dce7;border-radius:20px;padding:4px 9px}.body{padding:18px;container-type:inline-size}.url-form{display:flex;gap:8px;margin-bottom:12px}.url-form input{padding:10px;border:1px solid #adc2cf;border-radius:5px;flex:1;min-width:0}.stage{width:100%;min-width:0;background:#062c40;aspect-ratio:16/9;min-height:220px;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:6px}.stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.placeholder{text-align:center;color:#fff;padding:20px}.placeholder strong{display:block;font-size:19px}.placeholder p{font-size:13px;color:#cfdfeb;max-width:330px}.player-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}.player-layout.with-signing{grid-template-columns:minmax(0,1fr) 250px}.sign-box{width:250px;background:#f7fafc;border:1px solid #b8d2df;border-radius:7px;overflow:hidden;color:#355a70;animation:sign-open 150ms ease-out}.sign-label{font-size:11px;font-weight:bold;letter-spacing:.5px;background:#003c54;color:white;padding:8px}.sign-placeholder,.sign-status{margin:0;padding:10px;font-size:12px;line-height:1.5}.sign-viewport{aspect-ratio:1;background:#182e3e;display:grid;place-items:center}.sign-viewport video{width:100%;height:100%;min-height:0;object-fit:contain;aspect-ratio:1}.sign-action,.expand-sign{margin:0 8px 9px;font-size:12px;padding:7px}.sign-dialog{width:min(640px,95vw);max-height:90vh;overflow:auto;padding:16px;border:2px solid #006b89;border-radius:8px;color:#17394e}.sign-dialog::backdrop{background:#00192799}.sign-dialog h3{margin:0 0 12px;font-size:17px}.sign-dialog .sign-viewport{margin-top:12px;aspect-ratio:auto}.sign-dialog video{max-height:65vh;aspect-ratio:auto}.sign-dialog .sign-status{font-size:14px}.preview-mode{display:flex;gap:6px;align-items:center;padding:8px;font-size:11px}.preview-mode select{min-width:0;flex:1;padding:7px;border:1px solid #b6cbd6;border-radius:5px;background:white;color:#17394e;font:inherit}.teacher-surface{position:relative;aspect-ratio:1;background:radial-gradient(ellipse at 50% 35%,#fff,#dceaf2)}.teacher-canvas{position:absolute;inset:0}.teacher-tools{display:grid;gap:7px;padding:10px}.teacher-tools select{width:100%;font:inherit;font-size:12px;padding:6px}.teacher-cameras{display:flex;flex-wrap:wrap;gap:5px}.teacher-cameras button{font-size:11px;padding:6px}.teacher-renderer-status{margin:0;font-size:11px;line-height:1.5}.concept-card{margin-top:12px;padding:12px;border:1px solid #c8dce7;border-radius:8px;background:#f1f7fa}.concept-card h4{font-size:15px;line-height:1.4;margin:0}.concept-diagram{list-style:none;padding:0;margin:12px 0;display:flex;gap:14px;flex-wrap:wrap}.concept-diagram li{position:relative;flex:1 1 60px;border:1px solid #adcad8;border-radius:6px;padding:8px 5px;background:white;font-size:11px;text-align:center;overflow-wrap:anywhere}.concept-diagram li.active{background:#006b80;color:white;border-color:#006b80}.concept-diagram[data-kind=flow] li:not(:last-child)::after{content:"→";position:absolute;right:-12px;color:#17627b}.concept-diagram[data-kind=merge]{display:grid;grid-template-columns:1fr 1fr}.concept-diagram[data-kind=merge] li:last-child{grid-column:1/-1}.concept-explanation{font-size:13px;line-height:1.65}.concept-source{display:inline-block;font-size:12px;color:#006783}.demonstration-controls{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.demonstration-controls button,.demonstration-controls select{font-size:12px;padding:7px}.demonstration-controls p{width:100%;margin:4px 0;font-size:12px}.gesture-viewport{background:#eaf3f6}.gesture-viewport svg{display:block;width:100%;height:auto;max-height:400px}.gesture-note{font-size:10px;line-height:1.5;padding:8px 10px;margin:0;color:#6c512c;background:#fff7e7}.spelling-label{margin:0;padding:8px;text-align:center;font-size:18px;font-weight:bold;color:#006783}.animation-controls{display:grid;gap:7px;padding:8px}.animation-controls select{width:100%;padding:6px;font:inherit;font-size:11px}.motion-toggle{font-size:11px;padding:7px}.motion-state{margin:0;font-size:11px;color:#4d6b7b}.alphabet-reference{display:block;padding:0 10px 8px;font-size:10px;color:#006783}.gesture-description{font-size:10px;color:#4f6b7b;padding:5px 10px;margin:0}.live-caption{padding:12px;border-top:1px solid #d6e5eb;background:white}.caption-heading{display:flex;justify-content:space-between;gap:8px;font-size:10px;letter-spacing:.5px;color:#006783}.caption-time{font-variant-numeric:tabular-nums}.caption-words{font-size:15px;line-height:1.65;margin:10px 0;max-height:210px;overflow:auto;overflow-wrap:anywhere;color:#153b50}.live-caption small{display:block;font-size:10px;color:#637985}.preview-generate{font-size:12px;background:#006b89;border-color:#006b89;color:white;margin:0 0 8px}.sign-dialog .caption-words{font-size:19px;max-height:300px}.sign-dialog .gesture-viewport svg{max-height:45vh}.sign-dialog .preview-mode{font-size:14px}@keyframes sign-open{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.sign-box{animation:none}}.controls{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:13px}.primary{background:#006b89;color:white;border-color:#006b89}.playback-controls{margin:0 0 12px}.caption-options{margin-top:12px}.caption-options summary{cursor:pointer;color:#006783;font-size:12px}.playback-speed{padding:8px;font:inherit;border:1px solid #b5cbd8;border-radius:5px}.controls label{display:flex;align-items:center;gap:7px;font-size:12px}.controls input{width:17px;height:17px}.status{font-size:12px;color:#3b5f75;margin:12px 0 0;min-height:20px}.transcript{margin-top:18px;border-top:1px solid #dce6ed;padding-top:15px}.transcript h3{font-size:16px;margin:0 0 7px}.transcript small{display:block;font-size:12px;color:#5b6f7c}.cues{max-height:300px;overflow:auto;margin-top:12px}.cue{width:100%;text-align:left;display:flex;align-items:baseline;gap:12px;border:0;border-top:1px solid #e8eff4;border-radius:0;padding:11px 5px;background:white;font-size:13px}.cue.active{background:#eaf7fc}.time{font-weight:bold;white-space:nowrap;color:#006580;font-size:11px}.download{font-size:12px;color:#005d7b;text-decoration:underline;margin-left:auto}@container(max-width:700px){.player-layout.with-signing{grid-template-columns:minmax(0,1fr)}.sign-box{width:100%}.learning-preview[data-mode=both]{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.preview-mode{grid-column:1/-1}.gesture-viewport,.sign-viewport,.spelling-label,.gesture-note,.gesture-description,.animation-controls,.alphabet-reference,.teacher-tools{grid-column:1}.live-caption{grid-column:2;grid-row:2/span 8;border-left:1px solid #d6e5eb}.gesture-viewport svg{max-height:260px}}@container(max-width:400px){.learning-preview[data-mode=both]{display:block}.sign-box{width:100%}.caption-words{font-size:16px}}@media(min-width:700px){.sign-dialog .learning-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.sign-dialog .preview-mode{grid-column:1/-1}.sign-dialog .gesture-viewport,.sign-dialog .spelling-label,.sign-dialog .gesture-note,.sign-dialog .gesture-description,.sign-dialog .animation-controls,.sign-dialog .teacher-tools,.sign-dialog .alphabet-reference{grid-column:1}.sign-dialog .live-caption{grid-column:2;grid-row:2/span 10}.sign-dialog .teacher-surface{max-height:310px}}.learning-preview[data-explaining=true] .animation-controls>select,.learning-preview[data-explaining=true] .gesture-description,.learning-preview[data-explaining=true] .spelling-label{display:none}.sign-dialog .learning-preview[data-explaining=true] .teacher-surface{position:sticky;top:0;z-index:1;max-height:260px}.sign-dialog .learning-preview[data-explaining=true] .teacher-tools>select{display:none}@media(max-width:650px){.player-layout.with-signing{grid-template-columns:minmax(0,1fr)}.sign-box{width:100%}.url-form{flex-wrap:wrap}.url-form input{flex-basis:100%}.bar{padding:12px}.body{padding:12px}.bar strong{font-size:14px}.badge{font-size:10px}.placeholder strong{font-size:15px}.placeholder p{font-size:11px;max-width:190px}.stage{min-height:230px}.controls label{font-size:11px}}`;
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
    sign.setAttribute("aria-label", "Captions and visual support");
    sign.append(
      make("div", "AI CAPTIONS + AVATAR", "sign-label"),
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
    const transcribe = make("button", "Generate AI captions", "primary");
    transcribe.type = "button";
    transcribe.onclick = async () => {
      if (this.transcribing) return;
      if (!check.checked) {
        this.status.textContent =
          "Select the sharing choice before sending the video to Gemini.";
        this.transcriptionError =
          "Select the video-sharing checkbox below, then generate captions.";
        this.learningPreview?.error(this.transcriptionError);
        this.root.querySelector<HTMLDetailsElement>(".caption-options")!.open =
          true;
        check.focus();
        return;
      }
      this.transcribing = true;
      this.transcriptionError = "";
      try {
        const requested = youtubeUrl(input.value);
        if (!this.frame || requested !== this.videoUrl) {
          await this.load(requested);
          if (requested !== this.videoUrl) return;
        }
        transcribe.disabled = true;
        this.learningPreview?.generating(true);
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
        this.transcriptionError =
          this.status.textContent || "Transcription failed. Try again.";
        this.learningPreview?.error(this.transcriptionError);
      } finally {
        this.transcribing = false;
        this.learningPreview?.generating(false);
        transcribe.disabled = false;
      }
    };
    const toggle = make("button", "Show learning panel", "sign-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", sign.id);
    toggle.onclick = () => {
      sign.hidden = !sign.hidden;
      toggle.textContent = sign.hidden
        ? "Show learning panel"
        : "Hide learning panel";
      toggle.setAttribute("aria-expanded", String(!sign.hidden));
      layout.classList.toggle("with-signing", !sign.hidden);
      if (sign.hidden) {
        this.closeSigningDialog?.(false);
        this.signVideo?.pause();
        this.updateLearningPreview();
      } else {
        if (!this.signVideo && this.sign) this.showSigning();
        this.synchronize();
        if (window.innerWidth < 700) sign.scrollIntoView?.({ block: "start" });
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
      if (sign.hidden) toggle.click();
      this.learningPreview?.explain(this.snapshot().currentTime);
      if (!this.signingDialog)
        this.root.querySelector<HTMLButtonElement>(".expand-sign")?.click();
      this.dispatchEvent(
        new CustomEvent("mela:explain-moment", {
          bubbles: true,
          composed: true,
          detail: { video: this.snapshot(), cues: this.transcript.cues },
        }),
      );
    };
    const play = make("button", "Play lesson", "play-lesson");
    play.type = "button";
    play.disabled = true;
    play.onclick = () => {
      if (!this.playerReady) return;
      if (this.player?.getPlayerState() === 1) this.player.pauseVideo();
      else this.player?.playVideo();
    };
    const speed = make("select", undefined, "playback-speed");
    speed.setAttribute("aria-label", "Playback speed");
    speed.disabled = true;
    for (const rate of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
      const option = make("option", `${rate}× speed`);
      option.value = String(rate);
      speed.append(option);
    }
    speed.value = "1";
    speed.onchange = () => this.player?.setPlaybackRate(Number(speed.value));
    const playback = make("div", undefined, "controls playback-controls");
    playback.append(play, speed, toggle, explain);
    controls.append(consent, transcribe);
    const captionOptions = make("details", undefined, "caption-options");
    captionOptions.append(make("summary", "Caption tools"), controls);
    this.status = make(
      "p",
      "Generate captions from your video, then open the learning panel. Captions and experimental gestures follow playback.",
      "status",
    );
    this.status.setAttribute("role", "status");
    body.append(form, playback, layout, captionOptions, this.status);
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
        this.apiUrl(
          `/v1/lessons/${encodeURIComponent(this.getAttribute("lesson-id") || "va-future")}/media?videoId=${youtubeId(source)}`,
        ),
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
      if (
        !this.frame &&
        !this.getAttribute("video-src") &&
        config.defaultVideoUrl
      ) {
        this.videoUrl = youtubeUrl(config.defaultVideoUrl);
        this.root.querySelector<HTMLInputElement>(".url-form input")!.value =
          this.videoUrl;
      }
      this.sign =
        config.signLanguage?.videoId === youtubeId(this.videoUrl)
          ? {
              ...config.signLanguage,
              url: this.remoteUrl(config.signLanguage.url),
            }
          : undefined;
      this.showSigning();
      this.restoreTranscript();
      this.publishVideo();
      if (!this.transcript)
        await this.loadPreparedTranscript(config.transcriptUrl, version);
    } catch {
      if (version !== this.configurationVersion || !this.isConnected) return;
      this.sign = undefined;
      this.showSigning(
        "Signing availability could not be checked. Try again.",
        true,
      );
      this.restoreTranscript();
      this.publishVideo();
      if (!this.transcript)
        await this.loadPreparedTranscript(
          `/transcripts/${youtubeId(this.videoUrl)}.json`,
          version,
        );
    }
  }
  private async loadPreparedTranscript(
    path: string | undefined,
    version: number,
  ) {
    if (!path) return;
    const source = this.videoUrl;
    try {
      const response = await fetch(this.remoteUrl(path), {
        signal: this.configurationController?.signal,
      });
      if (!response.ok) return;
      const data = await response.json();
      if (
        version !== this.configurationVersion ||
        source !== this.videoUrl ||
        !this.isConnected ||
        !validTranscript(data, source)
      )
        return;
      this.transcript = data;
      try {
        localStorage.setItem(
          "mela-video-transcript:" + youtubeId(source),
          JSON.stringify(data),
        );
      } catch {}
      this.drawTranscript(data);
      this.updateLearningPreview();
      this.dispatchTranscript(data.cues);
      this.status.textContent =
        "English course captions ready. Open the learning panel and play the video.";
    } catch {}
  }
  private restoreTranscript() {
    try {
      const data = JSON.parse(
        localStorage.getItem(
          "mela-video-transcript:" + youtubeId(this.videoUrl),
        ) || "null",
      );
      if (!validTranscript(data, this.videoUrl)) return;
      this.transcript = data;
      this.drawTranscript(data);
      this.updateLearningPreview();
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
    this.transcriptionError = "";
    this.root.querySelector(".transcript")?.remove();
    this.dispatchTranscript([]);
    clearInterval(this.timer);
    this.player?.destroy();
    this.player = undefined;
    this.playerReady = false;
    this.root.querySelector<HTMLButtonElement>(".play-lesson")!.disabled = true;
    this.root.querySelector<HTMLSelectElement>(".playback-speed")!.disabled =
      true;
    this.clearSigning();
    this.sign = undefined;
    this.videoUrl = canonical;
    this.root.querySelector<HTMLInputElement>(".url-form input")!.value =
      canonical;
    this.root.querySelector("iframe")?.remove();
    this.root.querySelector(".placeholder")?.remove();
    const frame = make("iframe");
    frame.title = "Course video on YouTube";
    frame.allow =
      "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.src = `https://www.youtube-nocookie.com/embed/${youtubeId(canonical)}?enablejsapi=1&rel=0&playsinline=1&hl=en&origin=${encodeURIComponent(location.origin)}`;
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
          onReady: () => {
            if (this.frame !== frame || !this.isConnected) return;
            this.playerReady = true;
            this.root.querySelector<HTMLButtonElement>(
              ".play-lesson",
            )!.disabled = false;
            this.root.querySelector<HTMLSelectElement>(
              ".playback-speed",
            )!.disabled = false;
            this.status.textContent =
              "Video ready. Play the lesson to start synchronized captions and animation.";
            this.synchronize();
          },
          onStateChange: () => this.synchronize(),
          onPlaybackRateChange: () => this.synchronize(),
          onError: () => {
            if (this.frame === frame)
              this.status.textContent =
                "YouTube could not play this video here. Check your connection or open it on YouTube.";
          },
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
    this.learningPreview?.dispose();
    this.learningPreview = undefined;
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
    message = "AI captions + experimental avatar are ready.",
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
    if (!this.sign || this.sign.videoId !== youtubeId(this.videoUrl)) {
      this.root.querySelector(".sign-label")!.textContent =
        "AI CAPTIONS + AVATAR";
      this.mountPreview(content);
      this.enlargePanel(content, box, false);
      return;
    }
    this.root.querySelector(".sign-label")!.textContent =
      "CAPTIONS + REVIEWED ETHSL";
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
    this.mountPreview(content, viewport);
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
    this.enlargePanel(content, box, true);
  }
  private mountPreview(content: HTMLElement, visual?: HTMLElement) {
    this.learningPreview = mountLearningPreview(content, {
      visual,
      renderer:
        this.getAttribute("renderer") === "2d"
          ? "2d"
          : this.getAttribute("renderer") === "3d"
            ? "3d"
            : "auto",
      runtimeUrl: this.remoteUrl("/avatar/teacher-3d.js"),
      storyboardUrl: this.remoteUrl("/avatar/storyboard.json"),
      onResume: (seconds) => {
        if (!this.playerReady) {
          this.status.textContent = "Load the video before resuming.";
          return false;
        }
        this.closeSigningDialog?.(false);
        this.player?.seekTo(seconds, true);
        this.player?.playVideo();
        this.root
          .querySelector<HTMLButtonElement>(".play-lesson")
          ?.focus({ preventScroll: true });
        this.root
          .querySelector(".stage")
          ?.scrollIntoView?.({ block: "nearest" });
        return true;
      },
      onGenerate: () =>
        this.root.querySelector<HTMLButtonElement>(".primary")?.click(),
      onModeChange: (visible) => {
        if (!visible) this.signVideo?.pause();
        this.synchronize();
      },
    });
    this.learningPreview.generating(this.transcribing);
    if (this.transcriptionError)
      this.learningPreview.error(this.transcriptionError);
    this.updateLearningPreview();
  }
  private updateLearningPreview() {
    const visible = !this.root.querySelector<HTMLElement>(".sign-box")?.hidden;
    this.learningPreview?.update({
      cues: this.transcript?.cues || [],
      videoId: youtubeId(this.videoUrl),
      sourceLabel:
        this.transcript?.generated === false
          ? "COURSE CAPTIONS"
          : "AI CAPTIONS",
      seconds: Math.max(0, this.player?.getCurrentTime?.() || 0),
      playing: this.player?.getPlayerState?.() === 1,
      rate: this.player?.getPlaybackRate?.() || 1,
      visible,
    });
  }
  private enlargePanel(
    content: HTMLElement,
    box: HTMLElement,
    approved: boolean,
  ) {
    const expand = make(
      "button",
      approved ? "Enlarge signing" : "Enlarge panel",
      "expand-sign",
    );
    expand.type = "button";
    expand.onclick = () => {
      if (this.signingDialog) return;
      const dialog = make("dialog", undefined, "sign-dialog");
      this.signingDialog = dialog;
      const title = make(
        "h3",
        approved
          ? "Captions and Ethiopian Sign Language interpretation"
          : "AI captions and experimental avatar",
      );
      title.id = "signing-dialog-title";
      dialog.setAttribute("aria-labelledby", title.id);
      const close = make(
        "button",
        approved ? "Close enlarged signing" : "Close enlarged panel",
      );
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
    this.updateLearningPreview();
    if (!this.player || typeof this.player.getCurrentTime !== "function")
      return;
    const seconds = this.player.getCurrentTime() || 0;
    const play = this.root.querySelector<HTMLButtonElement>(".play-lesson");
    if (play)
      play.textContent =
        this.player.getPlayerState() === 1 ? "Pause lesson" : "Play lesson";
    const speed = this.root.querySelector<HTMLSelectElement>(".playback-speed");
    if (speed) speed.value = String(this.player.getPlaybackRate() || 1);
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
    if (
      this.root.querySelector<HTMLElement>(".sign-box")?.hidden ||
      video.closest<HTMLElement>(".sign-viewport")?.hidden
    ) {
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
            video.closest<HTMLElement>(".sign-viewport")?.hidden ||
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
    const response = await fetch(this.apiUrl("/v1/transcriptions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl, language: "en", consent: true }),
      signal: this.controller.signal,
    });
    const data = await response.json();
    if (version !== this.requestVersion || !this.isConnected) return;
    if (!response.ok)
      throw new Error(data.error || "Video transcription failed.");
    if (!validTranscript(data, videoUrl))
      throw new Error(
        "The provider returned invalid caption timing. Please retry.",
      );
    this.transcript = data;
    try {
      localStorage.setItem(
        "mela-video-transcript:" + youtubeId(videoUrl),
        JSON.stringify(data),
      );
    } catch {}
    this.drawTranscript(data);
    this.updateLearningPreview();
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
        data.generated === false
          ? "English source captions · review against the audio"
          : "AI-generated from this video’s audio · review before relying on it",
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

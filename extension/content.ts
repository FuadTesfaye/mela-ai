import { mountActions } from "../module/actions/panel";
import type { ActionResult } from "../module/actions/engine";
import { extractPage, pageDataContext } from "../module/actions/extract";
import { chromeApi } from "./chrome";
import { createSiteMemoryClient } from "./memory/client";
import { memoryControls } from "./memory/panel";
import { isYouTubeVideo, youtubeLiveCaptions } from "./youtube";
const state = globalThis as unknown as {
  __melaActions?: { destroy(): void; open(): void };
};
state.__melaActions?.destroy();
const languageNames: Record<string, string> = {
  en: "English",
  am: "Amharic",
  om: "Afaan Oromo",
  ti: "Tigrinya",
};
const chrome = chromeApi();
const client = createSiteMemoryClient();
const controls = memoryControls(client);
let voiceMode: "auto" | "gemini" | "device" = "auto";

async function ai<T>(message: Record<string, unknown>): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw new Error(
      response?.error || "Gemini is unavailable. Please try again.",
    );
  return response.value as T;
}

function pageText() {
  // YouTube: only this video's title, description and what was said — never
  // the sidebar of recommended videos, which would mislead the answer.
  if (isYouTubeVideo()) {
    const title =
      document.querySelector("#title h1, h1.ytd-watch-metadata")?.textContent ||
      document.title;
    const description =
      document.querySelector<HTMLElement>("#description, #description-inner")
        ?.innerText || "";
    const spoken = live?.transcript() || "";
    return [
      `Video title: ${title.trim()}`,
      spoken ? `Video transcript so far: ${spoken}` : "",
      description
        ? `Video description: ${description.trim().slice(0, 3000)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  // On a video, what has been said so far is the most useful context.
  const spoken = live?.transcript();
  const video = spoken ? `Video transcript so far: ${spoken}\n\n` : "";
  try {
    return video + pageDataContext(extractPage());
  } catch {
    return (document.body?.innerText || "")
      .replace(/\s+/g, " ")
      .slice(0, 20000);
  }
}

async function answer(
  question: string,
  language: string,
): Promise<ActionResult> {
  // "What do you remember…" keeps using local site memory.
  if (/\b(what do you remember|saved pages|site memory)\b/i.test(question))
    return client.answer(question);
  try {
    const text = await ai<string>({
      type: "mela:ask",
      question,
      language,
      page: { title: document.title, url: location.href, text: pageText() },
    });
    return { status: "done", message: text };
  } catch (error) {
    return {
      status: "unsupported",
      message:
        error instanceof Error ? error.message : "Gemini is unavailable.",
    };
  }
}

const actions = mountActions({
  // Simulate against the local dev server when testing on localhost.
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? location.origin + "/api/v1"
    : "https://mela-ai-wheat.vercel.app/api/v1",
  assistant: true,
  onLanguageChange: (language) => {
    // Remember the language for every page and the next visit.
    void chrome.runtime
      .sendMessage({ type: "mela:setPrefs", language })
      .catch(() => {});
    if (live?.active)
      actions.say(
        `🎬 Live captions now in ${languageNames[language] || "English"}.`,
      );
  },
  tts: (text, language) => ai<string>({ type: "mela:tts", text, language }),
  voiceMode: () => voiceMode,
  // Mirror the live state on the toolbar icon badge.
  onStatus: (status) =>
    void chrome.runtime
      .sendMessage({ type: "mela:status", status })
      .catch(() => {}),
  shadowMode: "closed",
  extraControls: controls.element,
  question: answer,
  speakAnswers: true,
  transcribe: (audio, mimeType, language) =>
    ai<string>({ type: "mela:transcribe", audio, mimeType, language }),
  signBox: {
    runtimeUrl: chrome.runtime.getURL("avatar/teacher-3d.js"),
    storyboardUrl: chrome.runtime.getURL("avatar/storyboard.json"),
  },
});
const ready: Record<string, string> = {
  en: "MELA is ready. Press Control Shift M and talk, or say: speak Oromo.",
  am: "መላ ዝግጁ ነው። ኮንትሮል ሺፍት ኤም ይጫኑና ይናገሩ።",
  om: "MELA qophaa'eera. Control Shift M tuqiitii dubbadhu.",
  ti: "መላ ድሉው እዩ። ኮንትሮል ሺፍት ኤም ጠውቑ እሞ ተዛረቡ።",
};
/** Speak once the browser allows audio (after any key or click on the page). */
const greet = () => {
  const text = ready[actions.getLanguage()] || ready.en;
  const activated = (
    navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }
  ).userActivation?.hasBeenActive;
  if (activated) return void actions.announce(text);
  actions.say(text); // screen readers read this right away (live region)
  const go = () => {
    removeEventListener("keydown", go, true);
    removeEventListener("pointerdown", go, true);
    void actions.announce(text);
  };
  addEventListener("keydown", go, true);
  addEventListener("pointerdown", go, true);
};
void ai<{ voice: typeof voiceMode; language?: string }>({ type: "mela:prefs" })
  .then((prefs) => {
    voiceMode = prefs.voice;
    if (prefs.language && prefs.language !== actions.getLanguage())
      actions.setLanguage(prefs.language as Parameters<typeof actions.setLanguage>[0]);
  })
  .catch(() => {})
  .finally(greet);
// ---- YouTube: live translated captions for Deaf / other-language viewers ----
let live: ReturnType<typeof youtubeLiveCaptions> | undefined;
let liveButton: HTMLElement | undefined;
let preparedLoaded = false;
const setLive = (on: boolean) => {
  if (!live) return;
  if (on && live.start()) {
    const name = languageNames[actions.getLanguage()] || "English";
    actions.say(
      `🎬 Live captions are on in ${name}. They appear over the video and in the sign box. Change the language below any time.`,
    );
  } else if (!on) {
    live.stop();
    actions.say("Live captions are off.");
  }
  if (liveButton)
    liveButton.textContent = live.active
      ? "🎬 Captions on"
      : "🎬 Live captions";
};
if (isYouTubeVideo()) {
  live = youtubeLiveCaptions({
    ai,
    language: () => actions.getLanguage(),
    onCaption: (text, language) => {
      // With prepared captions the sign box follows the video itself.
      if (!preparedLoaded) actions.showCaption(text, language);
    },
    status: (message) => actions.say(message),
  });
  liveButton = actions.makeButton("🎬 Live captions", () =>
    setLive(!live?.active),
  );
  actions.addTool(liveButton);
  void (async () => {
    const videoId = new URLSearchParams(location.search).get("v") || "";
    const prepared = await ai<
      | {
          cues: { start: number; end: number; text: string }[];
          amCues?: { start: number; end: number; text: string }[];
        }
      | undefined
    >({ type: "mela:transcript", videoId }).catch(() => undefined);
    const element = document.querySelector<HTMLVideoElement>(
      "#movie_player video, video",
    );
    if (prepared?.cues.length && element) {
      preparedLoaded = true;
      live!.usePrepared(prepared.cues, prepared.amCues);
      // Teacher, captions and concept cards follow the real video.
      actions.followVideo({
        element,
        cues: prepared.cues,
        amCues: prepared.amCues,
        videoId,
        language: () => actions.getLanguage(),
      });
      const explain = actions.makeButton("💡 Explain", () => {
        if (actions.explainVideo())
          actions.say(
            "💡 Paused. The teacher is explaining this moment — press Resume lesson to continue.",
          );
      });
      explain.className = "explain";
      actions.addTool(explain);
      actions.say(
        "🎓 This video has prepared lesson captions. The teacher follows along — press 💡 Explain any time.",
      );
    }
    setLive(true);
  })();
}
// Ctrl/⌘+Shift+M talks to MELA (same shortcut as the MELA website).
const talkKey = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyM") {
    e.preventDefault();
    e.stopPropagation();
    actions.talk();
  }
};
addEventListener("keydown", talkKey, true);
state.__melaActions = {
  open: () => actions.open(),
  destroy() {
    removeEventListener("keydown", talkKey, true);
    live?.stop();
    controls.destroy();
    actions.destroy();
  },
};
actions.open();

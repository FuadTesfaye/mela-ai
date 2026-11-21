import { chromeApi } from "./chrome";
import { groqChat, groqSpeak, groqTranscribe } from "./groq";
import { createMemoryService } from "./memory/service";
import {
  askGemini,
  askPrompt,
  geminiText,
  languageName,
  transcribeGemini,
  speakGemini,
  GEMINI_SETTINGS_KEY,
  DEFAULT_MODEL,
  type GeminiSettings,
} from "./gemini";
const chrome = chromeApi();
// Keep persisted context out of untrusted page/content-script storage access.
const restricted = chrome.storage.local
  .setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  .then(
    () => true,
    () => false,
  );
const memory = createMemoryService(
  chrome.storage.local,
  chrome.runtime.id,
  chrome.runtime.getURL("options.html"),
  () => chrome.runtime.openOptionsPage(),
);
const geminiSettings = async (): Promise<GeminiSettings> => {
  const stored = (await chrome.storage.local.get(GEMINI_SETTINGS_KEY))[
    GEMINI_SETTINGS_KEY
  ] as Partial<GeminiSettings> | undefined;
  return {
    key: typeof stored?.key === "string" ? stored.key.trim() : "",
    model:
      typeof stored?.model === "string" && stored.model
        ? stored.model
        : DEFAULT_MODEL,
    voice: ["gemini", "device"].includes(String(stored?.voice))
      ? (stored!.voice as GeminiSettings["voice"])
      : "auto",
    groqKey: typeof stored?.groqKey === "string" ? stored.groqKey.trim() : "",
  };
};
/** Try providers in order; return the first success, or throw the last error. */
async function firstOf<T>(attempts: (false | (() => Promise<T>))[]) {
  let last: unknown = new Error("No AI provider is configured.");
  for (const attempt of attempts) {
    if (!attempt) continue;
    try {
      return await attempt();
    } catch (error) {
      last = error;
    }
  }
  throw last;
}
type AiMessage = {
  type:
    | "mela:ask"
    | "mela:transcribe"
    | "mela:tts"
    | "mela:prefs"
    | "mela:translate";
  context?: string;
  text?: string;
  question?: string;
  language?: string;
  page?: { title?: string; url?: string; text?: string };
  audio?: string;
  mimeType?: string;
};
chrome.runtime.onMessage.addListener((raw, sender, reply) => {
  const message = raw as unknown as AiMessage;
  if (
    ![
      "mela:ask",
      "mela:transcribe",
      "mela:tts",
      "mela:prefs",
      "mela:translate",
    ].includes(message?.type)
  )
    return;
  if ((sender as { id?: string }).id !== chrome.runtime.id) return;
  // Questions typed in Ethiopic script are Amharic, whatever the panel says.
  const language = /[\u1200-\u137f]/.test(String(message.question || ""))
    ? "am"
    : String(message.language || "en").slice(0, 5);
  void (async () => {
    const settings = await geminiSettings();
    if (message.type === "mela:prefs")
      return {
        voice: settings.voice,
        connected: !!(settings.key || settings.groqKey),
      };
    const gemini = !!settings.key,
      groq = !!settings.groqKey;
    if (!gemini && !groq) {
      chrome.runtime.openOptionsPage().catch(() => {});
      throw new Error(
        "Add a Gemini or Groq API key in the MELA extension settings (the page just opened), then ask again.",
      );
    }
    if (message.type === "mela:translate") {
      // Live video captions → the viewer's language.
      const target = String(message.language || "en").slice(0, 5);
      const text = String(message.text || "")
        .trim()
        .slice(0, 1500);
      if (!text) return "";
      const system = `You translate live video captions for Deaf viewers. Translate the caption into ${languageName(target)}. Use simple, clear, natural everyday language. Output only the translation, with no quotes, notes or explanations.`;
      const context = String(message.context || "").slice(-600);
      const user =
        (context
          ? `Earlier captions, for context only (do not translate): ${context}\n\n`
          : "") + `Caption to translate: ${text}`;
      const viaGroq = groq && (() => groqChat(settings.groqKey!, system, user));
      const viaGemini = gemini && (() => geminiText(settings, user, system));
      return firstOf(
        target === "en" ? [viaGroq, viaGemini] : [viaGemini, viaGroq],
      );
    }
    if (message.type === "mela:tts") {
      const text = String(message.text || "")
        .trim()
        .slice(0, 1500);
      if (!text) throw new Error("Nothing to say.");
      // Groq's Orpheus voice is English-only; Gemini covers other languages.
      return firstOf([
        groq && language === "en" && (() => groqSpeak(settings.groqKey!, text)),
        gemini && (() => speakGemini(settings, text, language)),
      ]);
    }
    if (message.type === "mela:transcribe") {
      const audio = String(message.audio || "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audio) || audio.length > 2800000)
        throw new Error("Use a short microphone recording.");
      const mime = String(message.mimeType || "audio/webm").split(";")[0];
      // Whisper on Groq is ~1 s; Gemini is the fallback.
      return firstOf([
        groq &&
          (() => groqTranscribe(settings.groqKey!, audio, mime, language)),
        gemini && (() => transcribeGemini(settings, audio, mime, language)),
      ]);
    }
    const question = String(message.question || "")
      .trim()
      .slice(0, 2000);
    if (!question) throw new Error("Type or say a question first.");
    const input = {
      question,
      language,
      page: {
        title: String(message.page?.title || "").slice(0, 300),
        url: String(message.page?.url || "").slice(0, 2000),
        text: String(message.page?.text || "").slice(0, 20000),
      },
    };
    const prompt = askPrompt(input);
    const viaGroq =
      groq && (() => groqChat(settings.groqKey!, prompt.system, prompt.user));
    const viaGemini = gemini && (() => askGemini(settings, input));
    // English: Groq is fastest. Amharic and others: Gemini writes far better.
    return firstOf(
      language === "en" ? [viaGroq, viaGemini] : [viaGemini, viaGroq],
    );
  })().then(
    (value) => reply({ ok: true, value }),
    (error) =>
      reply({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gemini is unavailable. Please try again.",
      }),
  );
  return true;
});
const badges: Record<string, [string, string, string]> = {
  live: ["ON", "#12a150", "MELA is live on this page"],
  listening: ["MIC", "#d93025", "MELA: microphone ON, listening"],
  thinking: ["…", "#e0a100", "MELA is thinking"],
  speaking: ["TALK", "#0b57d0", "MELA is speaking"],
  jarvis: ["AI", "#8e44e0", "MELA Jarvis mode is on"],
  off: ["", "#12a150", "Open MELA on this page"],
};
chrome.runtime.onMessage.addListener((raw, sender) => {
  const message = raw as unknown as { type?: string; status?: string };
  if (message?.type !== "mela:status") return undefined;
  const tabId = (sender as { tab?: { id?: number } }).tab?.id;
  const badge = badges[String(message.status)];
  if (tabId === undefined || !badge) return undefined;
  const [text, color, title] = badge;
  void chrome.action.setBadgeText({ tabId, text });
  void chrome.action.setBadgeBackgroundColor?.({ tabId, color });
  void chrome.action.setTitle({ tabId, title });
  return undefined;
});
chrome.runtime.onInstalled?.addListener(async (details) => {
  if (details.reason !== "install") return;
  if (!(await geminiSettings()).key) chrome.runtime.openOptionsPage();
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== "mela:memory") return;
  void restricted
    .then((trusted) => {
      if (!trusted) throw new Error("Storage restriction failed.");
      return memory.handle(message, sender);
    })
    .then(
      (value) => reply({ ok: true, value }),
      () =>
        reply({
          ok: false,
          error:
            "Site memory is unavailable. Check the page type, memory settings or available storage.",
        }),
    );
  return true;
});
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  if (!/^https?:/.test(tab.url || "")) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    await chrome.action.setTitle({
      tabId: tab.id,
      title: "Open an ordinary HTTP(S) website to use MELA.",
    });
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["avatar/teacher-3d.js", "spelling.js", "content.js"],
    });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  } catch {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    await chrome.action.setTitle({
      tabId: tab.id,
      title: "MELA cannot run on this restricted page.",
    });
  }
});

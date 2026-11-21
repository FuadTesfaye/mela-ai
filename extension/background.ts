import { chromeApi } from "./chrome";
import { createMemoryService } from "./memory/service";
import {
  askGemini,
  transcribeGemini,
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
  };
};
type AiMessage = {
  type: "mela:ask" | "mela:transcribe";
  question?: string;
  language?: string;
  page?: { title?: string; url?: string; text?: string };
  audio?: string;
  mimeType?: string;
};
chrome.runtime.onMessage.addListener((raw, sender, reply) => {
  const message = raw as unknown as AiMessage;
  if (message?.type !== "mela:ask" && message?.type !== "mela:transcribe")
    return;
  if ((sender as { id?: string }).id !== chrome.runtime.id) return;
  const language = String(message.language || "en").slice(0, 5);
  void (async () => {
    const settings = await geminiSettings();
    if (!settings.key) {
      chrome.runtime.openOptionsPage().catch(() => {});
      throw new Error(
        "Add your Gemini API key in the MELA extension settings (the page just opened), then ask again.",
      );
    }
    if (message.type === "mela:transcribe") {
      const audio = String(message.audio || "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audio) || audio.length > 2800000)
        throw new Error("Use a short microphone recording.");
      return transcribeGemini(
        settings,
        audio,
        String(message.mimeType || "audio/webm").split(";")[0],
        language,
      );
    }
    const question = String(message.question || "")
      .trim()
      .slice(0, 2000);
    if (!question) throw new Error("Type or say a question first.");
    return askGemini(settings, {
      question,
      language,
      page: {
        title: String(message.page?.title || "").slice(0, 300),
        url: String(message.page?.url || "").slice(0, 2000),
        text: String(message.page?.text || "").slice(0, 20000),
      },
    });
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

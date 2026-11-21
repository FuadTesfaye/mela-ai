import { mountActions } from "../module/actions/panel";
import type { ActionResult } from "../module/actions/engine";
import { extractPage, pageDataContext } from "../module/actions/extract";
import { chromeApi } from "./chrome";
import { createSiteMemoryClient } from "./memory/client";
import { memoryControls } from "./memory/panel";
const state = globalThis as unknown as {
  __melaActions?: { destroy(): void; open(): void };
};
state.__melaActions?.destroy();
const chrome = chromeApi();
const client = createSiteMemoryClient();
const controls = memoryControls(client);

async function ai<T>(message: Record<string, unknown>): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw new Error(
      response?.error || "Gemini is unavailable. Please try again.",
    );
  return response.value as T;
}

function pageText() {
  try {
    return pageDataContext(extractPage());
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
  if (/\b(remember|saved|memory)\b/i.test(question))
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
state.__melaActions = {
  open: () => actions.open(),
  destroy() {
    controls.destroy();
    actions.destroy();
  },
};
actions.open();

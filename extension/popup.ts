/** Toolbar popup: opens MELA on the page right away, shows what is happening,
 * and keeps the API keys, language and "every website" switch one click away. */
import { GEMINI_SETTINGS_KEY, DEFAULT_MODEL, type GeminiSettings } from "./gemini";
type Chrome = {
  storage: {
    local: {
      get(k: string): Promise<Record<string, unknown>>;
      set(v: Record<string, unknown>): Promise<void>;
    };
  };
  tabs: { query(q: object): Promise<{ id?: number; url?: string }[]> };
  runtime: {
    sendMessage(m: unknown): Promise<{ ok: boolean; value?: unknown; error?: string }>;
    openOptionsPage(): Promise<void>;
  };
};
const chrome = (globalThis as unknown as { chrome: Chrome }).chrome;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const state = $<HTMLElement>("state"),
  openButton = $<HTMLButtonElement>("open"),
  auto = $<HTMLInputElement>("auto"),
  lang = $<HTMLSelectElement>("lang"),
  keysBox = $<HTMLDetailsElement>("keysBox"),
  keyCount = $<HTMLElement>("keyCount"),
  addis = $<HTMLInputElement>("addis"),
  groq = $<HTMLInputElement>("groq"),
  gemini = $<HTMLInputElement>("gemini"),
  msg = $<HTMLElement>("msg");
const show = (text: string, kind: "ok" | "warn" | "error" = "ok") => {
  state.textContent = text;
  state.dataset.kind = kind;
};
let settings: Partial<GeminiSettings> = {};
const hasKey = () => !!(settings.key || settings.groqKey || settings.addisKey);
const countKeys = () => {
  const n = [settings.addisKey, settings.groqKey, settings.key].filter(Boolean).length;
  keyCount.textContent = n ? `· ${n} saved ✓` : "· none yet";
};
const open = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    show("Open a normal website first (not a browser or new-tab page), then click MELA again.", "warn");
    return;
  }
  show("Opening MELA on this page…");
  const response = await chrome.runtime
    .sendMessage({ type: "mela:open", tabId: tab.id })
    .catch(() => undefined);
  if (!response?.ok) {
    show("MELA cannot run on this page. Try another website.", "error");
    return;
  }
  if (!hasKey()) {
    keysBox.open = true;
    show("MELA is open on the page ✓ — now paste an API key below so it can answer.", "warn");
    addis.focus();
    return;
  }
  show("✓ MELA is open on the page. Press Ctrl+Shift+M there and talk.");
  // Hand the keyboard back to the page so the user can talk straight away.
  setTimeout(() => window.close(), 1600);
};
openButton.onclick = () => void open();
void (async () => {
  const data = await chrome.storage.local.get(GEMINI_SETTINGS_KEY);
  settings = (data[GEMINI_SETTINGS_KEY] as Partial<GeminiSettings>) || {};
  addis.value = settings.addisKey || "";
  groq.value = settings.groqKey || "";
  gemini.value = settings.key || "";
  countKeys();
  const prefs = ((await chrome.storage.local.get("mela:prefs"))["mela:prefs"] ||
    {}) as { language?: string; autoOpen?: boolean };
  auto.checked = prefs.autoOpen !== false;
  lang.value = prefs.language || "en";
  await open();
})();
const savePrefs = (next: object) =>
  chrome.runtime.sendMessage({ type: "mela:setPrefs", ...next }).catch(() => undefined);
auto.onchange = () => void savePrefs({ autoOpen: auto.checked });
lang.onchange = () => void savePrefs({ language: lang.value });
$<HTMLButtonElement>("save").onclick = async () => {
  settings = {
    ...settings,
    addisKey: addis.value.trim(),
    groqKey: groq.value.trim(),
    key: gemini.value.trim(),
  };
  if (!hasKey()) {
    msg.textContent = "Paste at least one key first.";
    addis.focus();
    return;
  }
  await chrome.storage.local.set({
    [GEMINI_SETTINGS_KEY]: { model: DEFAULT_MODEL, voice: "auto", ...settings },
  });
  countKeys();
  msg.textContent = "Saved ✓ MELA can answer now. Press Ctrl+Shift+M on the page and talk.";
  show("✓ Ready. Press Ctrl+Shift+M on the page and talk.");
};
$<HTMLButtonElement>("settings").onclick = () => void chrome.runtime.openOptionsPage();

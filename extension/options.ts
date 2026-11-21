import { memoryRequest } from "./memory/client";
import type { MemoryStore } from "./memory/model";
import {
  askGemini,
  DEFAULT_MODEL,
  GEMINI_SETTINGS_KEY,
  type GeminiSettings,
} from "./gemini";
import { groqChat } from "./groq";
import { addisChat } from "./addis";
const root = document.querySelector<HTMLElement>("#sites")!,
  status = document.querySelector<HTMLElement>("#status")!;
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
};
let busy = false;
async function change(run: () => Promise<unknown>) {
  if (busy) return;
  busy = true;
  root.setAttribute("aria-busy", "true");
  try {
    await run();
    await refresh();
  } catch (e) {
    status.textContent =
      e instanceof Error ? e.message : "Could not update site memory.";
  } finally {
    busy = false;
    root.setAttribute("aria-busy", "false");
  }
}
const button = (text: string, run: () => Promise<unknown>) => {
  const b = element("button", text);
  b.type = "button";
  b.onclick = () => void change(run);
  return b;
};
async function refresh() {
  const store = await memoryRequest<MemoryStore>("list");
  root.replaceChildren();
  let total = 0;
  for (const site of store.sites) {
    total += site.pages.length;
    const card = element("article");
    card.append(
      element("h2", site.origin),
      element(
        "p",
        (site.enabled
          ? "Memory on"
          : "Paused · saved context is not used for answers") +
          " · " +
          site.pages.length +
          " saved pages",
      ),
    );
    card.append(
      button(site.enabled ? "Pause this site" : "Resume this site", () =>
        memoryRequest("toggle", {
          origin: site.origin,
          enabled: !site.enabled,
        }),
      ),
      button("Forget this site", async () => {
        if (confirm("Delete every saved page for " + site.origin + "?"))
          await memoryRequest("forget", { origin: site.origin });
      }),
    );
    for (const page of site.pages) {
      const detail = element("details");
      detail.append(
        element(
          "summary",
          page.title + " · " + new Date(page.savedAt).toLocaleDateString(),
        ),
        element(
          "p",
          "Saved " +
            new Date(page.savedAt).toLocaleString() +
            " · " +
            page.visits +
            " remembered visit(s).",
        ),
      );
      const link = element("a", "Open original page");
      link.href = page.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      detail.append(
        link,
        element("p", page.text),
        button("Forget this page", async () => {
          if (
            confirm(
              "Remove this saved copy? If this site is still enabled, opening MELA on the page again can save a new copy.",
            )
          )
            await memoryRequest("remove-page", {
              origin: site.origin,
              url: page.url,
            });
        }),
      );
      card.append(detail);
    }
    root.append(card);
  }
  if (!store.sites.length)
    root.append(
      element(
        "p",
        "No saved sites yet. Open MELA on a public page and choose Remember this site.",
      ),
    );
  status.textContent =
    store.sites.length +
    " site(s), " +
    total +
    " saved page(s). Context is stored locally and never grants permission to perform website actions.";
}
document.querySelector<HTMLButtonElement>("#refresh")!.onclick = () =>
  void change(async () => {});
document.querySelector<HTMLButtonElement>("#clear")!.onclick = () =>
  void change(async () => {
    if (confirm("Permanently forget all MELA site context on this device?"))
      await memoryRequest("clear");
  });
void refresh().catch((e) => {
  status.textContent = e.message;
});

// Gemini settings: options page is a trusted extension context.
const storage = (
  globalThis as unknown as {
    chrome: {
      storage: {
        local: {
          get(k: string): Promise<Record<string, unknown>>;
          set(v: Record<string, unknown>): Promise<void>;
          remove(k: string): Promise<void>;
        };
      };
    };
  }
).chrome.storage.local;
const keyInput = document.querySelector<HTMLInputElement>("#gemini-key")!,
  modelInput = document.querySelector<HTMLInputElement>("#gemini-model")!,
  geminiStatus = document.querySelector<HTMLElement>("#gemini-status")!,
  voiceInput = document.querySelector<HTMLSelectElement>("#gemini-voice")!,
  groqInput = document.querySelector<HTMLInputElement>("#groq-key")!,
  addisInput = document.querySelector<HTMLInputElement>("#addis-key")!;
const current = (): GeminiSettings => ({
  key: keyInput.value.trim(),
  groqKey: groqInput.value.trim(),
  addisKey: addisInput.value.trim(),
  model: modelInput.value.trim() || DEFAULT_MODEL,
  voice: (["auto", "gemini", "device"].includes(voiceInput.value)
    ? voiceInput.value
    : "auto") as GeminiSettings["voice"],
});
void storage.get(GEMINI_SETTINGS_KEY).then((data) => {
  const saved = data[GEMINI_SETTINGS_KEY] as
    | Partial<GeminiSettings>
    | undefined;
  keyInput.value = saved?.key || "";
  modelInput.value = saved?.model || DEFAULT_MODEL;
  voiceInput.value = saved?.voice || "auto";
  groqInput.value = saved?.groqKey || "";
  addisInput.value = saved?.addisKey || "";
  geminiStatus.textContent =
    saved?.key || saved?.groqKey || saved?.addisKey
      ? "Connected. Click the MELA icon on any website and ask a question."
      : "No key saved yet. Paste a Groq or Gemini API key to turn on the talking assistant.";
});
document.querySelector<HTMLButtonElement>("#gemini-save")!.onclick =
  async () => {
    const value = current();
    if (!value.key && !value.groqKey && !value.addisKey) {
      geminiStatus.textContent = "Paste a Groq, Gemini or Addis AI key first.";
      groqInput.focus();
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(value.model)) {
      geminiStatus.textContent = "The model name contains invalid characters.";
      return;
    }
    await storage.set({ [GEMINI_SETTINGS_KEY]: value });
    geminiStatus.textContent =
      "Saved. Click the MELA icon on any website (or press Alt+Shift+M) and ask a question.";
  };
document.querySelector<HTMLButtonElement>("#gemini-test")!.onclick =
  async () => {
    const value = current();
    if (!value.key && !value.groqKey && !value.addisKey) {
      geminiStatus.textContent = "Paste a Groq, Gemini or Addis AI key first.";
      return;
    }
    geminiStatus.textContent = "Testing…";
    const results: string[] = [];
    const prompt =
      "Say hello and confirm you are ready, in one short sentence.";
    if (value.groqKey)
      try {
        const answer = await groqChat(
          value.groqKey,
          "You are MELA, a friendly assistant.",
          prompt,
        );
        results.push("Groq ✓ " + answer);
      } catch (e) {
        results.push("Groq ✗ " + (e instanceof Error ? e.message : "failed"));
      }
    if (value.key)
      try {
        const answer = await askGemini(value, {
          question: prompt,
          language: "en",
          page: { title: "MELA settings", url: "", text: "" },
        });
        results.push("Gemini ✓ " + answer);
      } catch (e) {
        results.push("Gemini ✗ " + (e instanceof Error ? e.message : "failed"));
      }
    if (value.addisKey)
      try {
        const answer = await addisChat(
          value.addisKey,
          "am",
          "You are MELA, a friendly assistant.",
          "ሰላም በል፤ ዝግጁ መሆንህን በአንድ አጭር ዓረፍተ ነገር አረጋግጥ።",
        );
        results.push("Addis AI ✓ " + answer);
      } catch (e) {
        results.push(
          "Addis AI ✗ " + (e instanceof Error ? e.message : "failed"),
        );
      }
    geminiStatus.textContent = results.join("\n");
  };
document.querySelector<HTMLButtonElement>("#gemini-remove")!.onclick =
  async () => {
    await storage.remove(GEMINI_SETTINGS_KEY);
    keyInput.value = "";
    groqInput.value = "";
    addisInput.value = "";
    geminiStatus.textContent = "Keys removed from this browser.";
  };

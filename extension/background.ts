import { chromeApi } from "./chrome";
import { createMemoryService } from "./memory/service";
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
      files: ["content.js"],
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

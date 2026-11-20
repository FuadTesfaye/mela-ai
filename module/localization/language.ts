import { languageOrEnglish } from "../../lib/languages";
import { loadFeature } from "./runtime";
import type { Language } from "../../lib/types";
export const languageRoot = (host: HTMLElement) =>
  host.closest<HTMLElement>("[data-mela-sdk-root]") || document.body || host;
export function initialLanguage(host: HTMLElement): Language {
  const explicit =
    host.getAttribute("lang") || languageRoot(host).dataset.melaLanguage;
  if (explicit) return languageOrEnglish(explicit);
  try {
    return languageOrEnglish(localStorage.getItem("mela-language"));
  } catch {
    return "en";
  }
}
export function setLanguage(
  host: HTMLElement,
  language: Language,
  persist = false,
) {
  const root = languageRoot(host);
  root.dataset.melaLanguage = language;
  if (persist)
    try {
      localStorage.setItem("mela-language", language);
    } catch {}
  for (const node of root.querySelectorAll<HTMLElement>(
    "db-assistant,mela-course-media",
  )) {
    if (node.getAttribute("lang") !== language)
      node.setAttribute("lang", language);
  }
  if (root === host && host.getAttribute("lang") !== language)
    host.setAttribute("lang", language);
  root.dispatchEvent(
    new CustomEvent("mela:language-change", {
      bubbles: true,
      composed: true,
      detail: { language },
    }),
  );
}
export async function enhanceLanguage(host: HTMLElement) {
  const origin = new URL(host.getAttribute("api") || "/api", location.href)
    .origin;
  const feature = await loadFeature<{
    mount: (host: HTMLElement) => void | Promise<void>;
  }>(new URL("/locale.js", origin).href, "MelaLocale");
  if (host.isConnected) await feature.mount(host);
}

import { chromeApi } from "../chrome";
import type { MemoryMessage } from "./service";
import { capturePage } from "./capture";
import { searchSiteMemory, type SiteView } from "./model";
import type { ActionResult } from "../../module/actions/engine";
export async function memoryRequest<T>(
  action: string,
  extra: Partial<MemoryMessage> = {},
): Promise<T> {
  const response = await chromeApi().runtime.sendMessage({
    type: "mela:memory",
    action,
    ...extra,
  });
  if (!response?.ok)
    throw new Error(response?.error || "Site memory is unavailable.");
  return response.value as T;
}
export function createSiteMemoryClient() {
  return {
    view: () => memoryRequest<SiteView>("site"),
    async remember() {
      const page = capturePage();
      if (
        !confirm(
          "Remember public context from this site?\n\n" +
            page.url +
            "\n\n" +
            page.text.slice(0, 800) +
            "\n\nContext stays on this device. MELA will refresh public pages when you open it on this site again.",
        )
      )
        return memoryRequest<SiteView>("site");
      return memoryRequest<SiteView>("remember", { page });
    },
    visit: () => memoryRequest<SiteView>("visit", { page: capturePage() }),
    toggle: (enabled: boolean) =>
      memoryRequest<SiteView>("toggle", { enabled }),
    forget: () => memoryRequest<SiteView>("forget"),
    manage: () => memoryRequest("manager"),
    async answer(question: string): Promise<ActionResult> {
      let view: SiteView = {
        origin: location.origin,
        enabled: false,
        pageCount: 0,
        pages: [],
      };
      try {
        view = await memoryRequest<SiteView>("site");
      } catch {}
      let current;
      try {
        current = capturePage();
      } catch {}
      const hits = searchSiteMemory(question, view, current);
      if (!hits.length)
        return {
          status: "unsupported",
          message:
            "I could not find this in the public page or remembered pages for this site. Remember a relevant page, or ask a different question.",
        };
      return {
        status: "done",
        sources: hits.map((hit) => ({ title: hit.title, url: hit.url })),
        message:
          "Source-only answer from this site. Saved pages may be outdated.\n\n" +
          hits
            .map(
              (hit) =>
                `${hit.title}\n${hit.text}\nSource: ${hit.url}\n${hit.current ? "Current page" : "Saved " + new Date(hit.savedAt).toLocaleString()}`,
            )
            .join("\n\n"),
      };
    },
  };
}

import { memoryRequest } from "./memory/client";
import type { MemoryStore } from "./memory/model";
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
          if (confirm("Remove this page from saved context?"))
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

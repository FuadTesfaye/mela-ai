import { createSiteMemoryClient } from "./client";
export function memoryControls(
  client: ReturnType<typeof createSiteMemoryClient>,
) {
  const panel = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Site memory";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const intro = document.createElement("p");
  intro.textContent =
    "Remember this site's public text on this device for next time.";
  const preview = document.createElement("p");
  preview.textContent = "";
  preview.hidden = true;
  const list = document.createElement("ul");
  let disposed = false;
  const button = (text: string, fn: () => Promise<unknown>) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.onclick = () => {
      b.disabled = true;
      void fn()
        .then(() => refresh())
        .catch((e) => {
          if (!disposed)
            status.textContent =
              e instanceof Error ? e.message : "Could not update site memory.";
        })
        .finally(() => {
          b.disabled = false;
        });
    };
    return b;
  };
  const remember = button("Remember this site", () => client.remember());
  const pause = button("Pause site memory", async () => {
    const view = await client.view();
    return client.toggle(!view.enabled);
  });
  const forget = button("Forget this site", async () => {
    if (confirm("Forget all remembered pages for this site?"))
      await client.forget();
  });
  async function refresh() {
    const view = await client.view();
    if (disposed) return;
    status.textContent = view.enabled
      ? `Memory on · ${view.pages.length} saved page${view.pages.length === 1 ? "" : "s"} on this site. Ask about them in Web command.`
      : view.pageCount
        ? "Memory paused for this site. Saved pages are not used for answers."
        : "Memory off for this site. Choose Remember this site to enable it.";
    pause.textContent = view.enabled
      ? "Pause site memory"
      : "Resume site memory";
    pause.disabled = !view.enabled && !view.pageCount;
    remember.textContent = view.enabled
      ? "Save / refresh this page"
      : "Remember this site";
    list.replaceChildren();
    for (const page of view.pages) {
      const li = document.createElement("li");
      li.textContent =
        page.title + " · saved " + new Date(page.savedAt).toLocaleString();
      list.append(li);
    }
  }
  panel.append(
    summary,
    intro,
    preview,
    status,
    remember,
    pause,
    forget,
    button("Review saved sites", () => client.manage()),
    list,
  );
  void (async () => {
    const view = await client.view();
    let warning = "";
    if (view.enabled) {
      try {
        await client.visit();
      } catch {
        warning =
          " This page could not be refreshed; earlier saved context is still available.";
      }
    }
    await refresh();
    if (warning && !disposed) status.textContent += warning;
  })().catch(() => {
    if (!disposed)
      status.textContent =
        "Memory unavailable on this page or in private browsing. Current-page commands still work.";
  });
  return {
    element: panel,
    destroy() {
      disposed = true;
      panel.remove();
    },
  };
}

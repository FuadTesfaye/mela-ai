import {
  MEMORY_KEY,
  pruneMemory,
  savePage,
  type SiteView,
  type MemoryStore,
} from "./model";
export interface MemoryStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(data: Record<string, unknown>): Promise<void>;
}
export interface MemorySender {
  id?: string;
  url?: string;
  frameId?: number;
  tab?: { url?: string; incognito?: boolean };
}
export interface MemoryMessage {
  type: string;
  action: string;
  page?: unknown;
  enabled?: boolean;
  origin?: string;
  url?: string;
}
export function createMemoryService(
  storage: MemoryStorage,
  extensionId: string,
  optionsUrl: string,
  openManager: () => Promise<void>,
  now: () => number = Date.now,
) {
  let queue: Promise<unknown> = Promise.resolve();
  const run = async (message: MemoryMessage, sender: MemorySender) => {
    if (sender.id !== extensionId || sender.tab?.incognito)
      throw new Error("Site memory is unavailable in this context.");
    const manager = sender.url === optionsUrl;
    if (
      !manager &&
      (!sender.tab?.url ||
        sender.frameId !== 0 ||
        new URL(sender.tab.url).origin !== new URL(sender.url || "").origin)
    )
      throw new Error("Use MELA in the active website’s main page.");
    const origin = manager ? message.origin : new URL(sender.url!).origin;
    if (
      !manager &&
      !["http:", "https:"].includes(new URL(sender.url!).protocol)
    )
      throw new Error("Only websites can use site memory.");
    if (message.action === "manager") {
      await openManager();
      return { opened: true };
    }
    let state = pruneMemory((await storage.get(MEMORY_KEY))[MEMORY_KEY], now());
    if (message.action === "list") {
      if (!manager)
        throw new Error("Review all sites in the extension memory manager.");
      await storage.set({ [MEMORY_KEY]: state });
      return state;
    }
    if (message.action === "clear") {
      if (!manager)
        throw new Error("Clear all context from the extension memory manager.");
      state = { version: 1, sites: [] };
    } else if (message.action === "remember") {
      if (manager || !origin)
        throw new Error("Save a page from its own website.");
      state = savePage(state, origin, message.page, now());
    } else if (message.action === "visit") {
      if (manager || !origin)
        throw new Error("Refresh a page from its own website.");
      if (state.sites.some((s) => s.origin === origin && s.enabled))
        state = savePage(state, origin, message.page, now());
    } else if (message.action === "toggle") {
      if (typeof message.enabled !== "boolean")
        throw new Error("Choose whether this site is remembered.");
      const site = state.sites.find((s) => s.origin === origin);
      if (!site) throw new Error("Remember a page on this site first.");
      site.enabled = message.enabled;
      site.updatedAt = now();
    } else if (message.action === "forget")
      state.sites = state.sites.filter((s) => s.origin !== origin);
    else if (message.action === "remove-page") {
      if (!manager)
        throw new Error("Remove individual pages in the memory manager.");
      const site = state.sites.find((s) => s.origin === origin);
      if (site) site.pages = site.pages.filter((p) => p.url !== message.url);
    } else if (message.action !== "site" && message.action !== "clear")
      throw new Error("Unknown memory action.");
    await storage.set({ [MEMORY_KEY]: state });
    if (manager) return state;
    const site = state.sites.find((s) => s.origin === origin);
    return {
      origin: origin!,
      enabled: site?.enabled || false,
      pageCount: site?.pages.length || 0,
      pages: site?.enabled ? site.pages : [],
    } satisfies SiteView;
  };
  return {
    handle(message: MemoryMessage, sender: MemorySender) {
      const result = queue.then(() => run(message, sender));
      queue = result.catch(() => {});
      return result;
    },
  };
}

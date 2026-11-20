import { tokenize } from "../../lib/retrieval/search";
export const MEMORY_KEY = "mela-site-memory-v1";
export const MAX_PAGES = 10,
  MAX_SITES = 25,
  MAX_TEXT = 12000,
  MAX_BYTES = 2 * 1024 * 1024,
  RETENTION_MS = 90 * 86400000;
export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  headings: string[];
}
export interface SavedPage extends PageSnapshot {
  savedAt: number;
  firstSavedAt: number;
  visits: number;
}
export interface SiteMemory {
  origin: string;
  enabled: boolean;
  updatedAt: number;
  pages: SavedPage[];
}
export interface MemoryStore {
  version: 1;
  sites: SiteMemory[];
}
export interface SiteView {
  origin: string;
  enabled: boolean;
  pageCount: number;
  pages: SavedPage[];
}
export interface MemoryHit {
  title: string;
  url: string;
  text: string;
  savedAt: number;
  current: boolean;
}
export function publicPageUrl(raw: string): string {
  const url = new URL(raw);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Only ordinary public web pages can be remembered.");
  if (
    url.pathname.length > 1200 ||
    /(?:^|\/)(?:login|log-in|signin|sign-in|signout|logout|auth|oauth|callback|account|accounts|profile|settings|checkout|payment|payments|billing|banking|password|reset|verify|verification|inbox|messages|mail|admin|dashboard|portal|orders|cart|transactions)(?:\/|$)/i.test(
      url.pathname,
    )
  )
    throw new Error(
      "Account, authentication and sensitive workflow pages are not saved.",
    );
  // Queries/fragments can carry search text, private tokens or account state.
  if (
    [...url.searchParams.keys()].some((k) =>
      /token|secret|password|auth|session|code|key|email/i.test(k),
    )
  )
    throw new Error(
      "This page URL contains private or authentication state and is not saved.",
    );
  url.search = "";
  url.hash = "";
  return url.href;
}
export function snapshot(value: unknown, origin: string): PageSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("No readable page context to save.");
  const p = value as PageSnapshot;
  if (
    typeof p.url !== "string" ||
    typeof p.title !== "string" ||
    typeof p.text !== "string" ||
    !Array.isArray(p.headings)
  )
    throw new Error("Invalid page context.");
  const url = publicPageUrl(p.url);
  if (new URL(url).origin !== origin)
    throw new Error("Site context must belong to the active website.");
  const text = p.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!text) throw new Error("No public readable text was found on this page.");
  return {
    url,
    title:
      p.title.replace(/\s+/g, " ").trim().slice(0, 200) ||
      new URL(url).hostname,
    text,
    headings: p.headings
      .filter((h): h is string => typeof h === "string")
      .slice(0, 12)
      .map((h) => h.replace(/\s+/g, " ").trim().slice(0, 160)),
  };
}
export function pruneMemory(value: unknown, now = Date.now()): MemoryStore {
  const store: MemoryStore = { version: 1, sites: [] };
  if (
    !value ||
    typeof value !== "object" ||
    (value as MemoryStore).version !== 1 ||
    !Array.isArray((value as MemoryStore).sites)
  )
    return store;
  const origins = new Set<string>();
  for (const raw of (value as MemoryStore).sites) {
    try {
      const origin = new URL(raw.origin).origin;
      if (
        origin !== raw.origin ||
        origins.has(origin) ||
        !["https:", "http:"].includes(new URL(origin).protocol) ||
        typeof raw.enabled !== "boolean" ||
        !Array.isArray(raw.pages) ||
        !Number.isFinite(raw.updatedAt) ||
        raw.updatedAt < now - RETENTION_MS
      )
        continue;
      const pages: SavedPage[] = [];
      const urls = new Set<string>();
      for (const page of raw.pages) {
        try {
          if (
            !Number.isFinite(page.savedAt) ||
            page.savedAt > now + 60000 ||
            page.savedAt < now - RETENTION_MS ||
            urls.has(page.url)
          )
            continue;
          const clean = snapshot(page, origin);
          if (urls.has(clean.url)) continue;
          urls.add(clean.url);
          pages.push({
            ...clean,
            savedAt: page.savedAt,
            firstSavedAt: Number.isFinite(page.firstSavedAt)
              ? Math.min(page.firstSavedAt, page.savedAt)
              : page.savedAt,
            visits: Number.isSafeInteger(page.visits)
              ? Math.max(1, Math.min(100000, page.visits))
              : 1,
          });
        } catch {}
      }
      origins.add(origin);
      store.sites.push({
        origin,
        enabled: raw.enabled,
        updatedAt: Math.min(now, raw.updatedAt),
        pages: pages.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_PAGES),
      });
    } catch {}
  }
  store.sites = store.sites
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SITES);
  while (
    new TextEncoder().encode(JSON.stringify(store)).byteLength > MAX_BYTES
  ) {
    let oldest: SiteMemory | undefined;
    for (const site of store.sites)
      if (
        site.pages.length &&
        (!oldest || site.pages.at(-1)!.savedAt < oldest.pages.at(-1)!.savedAt)
      )
        oldest = site;
    if (!oldest) break;
    oldest.pages.pop();
  }
  return store;
}
export function savePage(
  store: MemoryStore,
  origin: string,
  value: unknown,
  now = Date.now(),
): MemoryStore {
  const clean = snapshot(value, origin);
  const next = pruneMemory(structuredClone(store), now);
  let site = next.sites.find((s) => s.origin === origin);
  if (!site) {
    site = { origin, enabled: true, updatedAt: now, pages: [] };
    next.sites.unshift(site);
  }
  const previous = site.pages.find((p) => p.url === clean.url);
  site.pages = site.pages.filter((p) => p.url !== clean.url);
  site.pages.unshift({
    ...clean,
    savedAt: now,
    firstSavedAt: previous?.firstSavedAt || now,
    visits: (previous?.visits || 0) + 1,
  });
  site.enabled = true;
  site.updatedAt = now;
  return pruneMemory(next, now);
}
export function searchSiteMemory(
  question: string,
  view: SiteView,
  current?: PageSnapshot,
): MemoryHit[] {
  const terms = tokenize(question);
  if (!terms.length) return [];
  const pages: Array<SavedPage & { current: boolean }> = view.enabled
    ? view.pages.map((p) => ({ ...p, current: false }))
    : [];
  if (current) {
    const same = pages.findIndex((p) => p.url === current.url);
    if (same >= 0) pages.splice(same, 1);
    pages.unshift({
      ...current,
      savedAt: Date.now(),
      firstSavedAt: Date.now(),
      visits: 1,
      current: true,
    });
  }
  return pages
    .filter((p) => new URL(p.url).origin === view.origin)
    .flatMap((page) => {
      const chunks = page.text.match(/.{1,1000}(?:\s|$)/gu) || [
        page.text.slice(0, 1000),
      ];
      const title = tokenize(page.title + " " + page.headings.join(" "));
      return chunks.map((text) => {
        const words = tokenize(text);
        const overlap = terms.filter((t) => words.includes(t));
        return {
          score: overlap.length
            ? overlap.length +
              terms.filter((t) => title.includes(t)).length * 2 +
              (page.current ? 0.25 : 0)
            : 0,
          hit: {
            title: page.title,
            url: page.url,
            text: text.trim(),
            savedAt: page.savedAt,
            current: page.current,
          },
        };
      });
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.hit.savedAt - a.hit.savedAt)
    .slice(0, 3)
    .map((x) => x.hit);
}

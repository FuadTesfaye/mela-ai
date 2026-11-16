import {
  canonicalSource,
  preparedTranslator,
  translationValid,
  type TranslationItem,
  type TranslationPack,
  type AmharicPack,
} from "../../lib/localization/shared";
export const backend = (host: HTMLElement) =>
  new URL(host.getAttribute("api") || "/api", location.href);
export const asset = (host: HTMLElement, path: string) =>
  new URL(path, backend(host).origin).href;
const dictionaries = new Map<string, Promise<AmharicPack>>();
let database: Promise<IDBDatabase> | undefined;
function openDB() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Storage unavailable"));
      return;
    }
    const request = indexedDB.open("mela-translations", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("packs", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction("packs").objectStore("packs").get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return;
  }
}
export async function cachePut(key: string, value: unknown) {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("packs", "readwrite");
      tx.objectStore("packs").put({ key, value, at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const rows = await new Promise<{ key: string; at: number }[]>(
      (resolve, reject) => {
        const request = db.transaction("packs").objectStore("packs").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    const excess = rows
      .filter((row) => row.key.startsWith("text:"))
      .sort((a, b) => b.at - a.at)
      .slice(20);
    if (excess.length) {
      const tx = db.transaction("packs", "readwrite");
      for (const row of excess) tx.objectStore("packs").delete(row.key);
    }
  } catch {}
}
export async function clearCache() {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("packs", "readwrite");
      tx.objectStore("packs").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}
export function validDictionary(value: unknown): value is AmharicPack {
  const p = value as AmharicPack;
  return (
    !!p &&
    p.version === 1 &&
    p.status === "ai-draft" &&
    typeof p.ui === "object" &&
    !!p.ui &&
    Array.isArray(p.entries) &&
    p.entries.length <= 2000 &&
    p.entries.every(
      (e) =>
        typeof e.sourceText === "string" &&
        typeof e.targetText === "string" &&
        e.sourceText.length <= 6000 &&
        e.targetText.length <= 12000,
    )
  );
}
export function dictionary(host: HTMLElement) {
  const url = asset(host, "/i18n/am.json");
  let pending = dictionaries.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error("Dictionary");
        const value: unknown = await r.json();
        if (!validDictionary(value)) throw new Error("Dictionary");
        void cachePut("dictionary:" + url, value);
        return value;
      } catch {
        const saved = await cacheGet<AmharicPack>("dictionary:" + url);
        if (validDictionary(saved)) return saved;
        throw new Error("የአማርኛ መረጃ አልተጫነም። እንደገና ይሞክሩ።");
      }
    })();
    dictionaries.set(url, pending);
    pending.catch(() => dictionaries.delete(url));
  }
  return pending;
}
async function fingerprint(items: TranslationItem[]) {
  const source = canonicalSource(items);
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(source),
    );
    return Array.from(new Uint8Array(bytes))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  }
  // A non-secure host can still use prepared text; store the full canonical key.
  return source;
}
export async function translatedItems(
  host: HTMLElement,
  items: TranslationItem[],
  pack: AmharicPack,
  consent = false,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, string>> {
  const prepared = preparedTranslator(pack.entries),
    result = new Map<string, string>();
  const missing: TranslationItem[] = [];
  for (const item of items) {
    const found = item.kind === "code" ? item.text : prepared(item.text);
    if (found) result.set(item.id, found);
    else missing.push(item);
  }
  const batches: TranslationItem[][] = [];
  let batch: TranslationItem[] = [],
    size = 0;
  for (const item of missing) {
    if (batch.length >= 10 || size + item.text.length > 3000) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(item);
    size += item.text.length;
  }
  if (batch.length) batches.push(batch);
  for (const batch of batches) {
    const key =
        "text:" + backend(host).origin + ":" + (await fingerprint(batch)),
      canonical = canonicalSource(batch);
    let saved = await cacheGet<{ canonical: string; pack: TranslationPack }>(
      key,
    );
    let value =
      saved?.canonical === canonical && translationValid(saved.pack, batch)
        ? saved.pack
        : undefined;
    if (!value && consent) {
      const response = await fetch(
        backend(host).href.replace(/\/$/, "") + "/v1/translations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceLanguage: "en",
            targetLanguage: "am",
            cloudConsent: true,
            items: batch,
          }),
          signal: AbortSignal.timeout(35000),
        },
      );
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "የትርጉም አገልግሎቱ ተጨናንቋል። ቆይተው ይሞክሩ።"
            : "ትርጉም አይገኝም። የእንግሊዝኛ ምንጩ አሁንም ይገኛል።",
        );
      const raw: unknown = await response.json();
      if (!translationValid(raw, batch))
        throw new Error("የተመለሰው ትርጉም ያልተሟላ ነው።");
      // When WebCrypto exists, bind the provider result to this exact source.
      if (
        raw.sourceRevision !== (await fingerprint(batch)) &&
        globalThis.crypto?.subtle
      )
        throw new Error("የትርጉሙ ምንጭ አይዛመድም።");
      value = raw;
      await cachePut(key, { canonical, pack: raw });
    }
    if (value) for (const item of value.items) result.set(item.id, item.text);
    onProgress?.(result.size, items.length);
  }
  return result;
}

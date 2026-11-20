import type { CoursePack } from "../../lib/courses/catalogue";
export type DownloadState = {
  id: string;
  revision: string;
  completed: number;
  total: number;
  state: "downloading" | "cancelled" | "ready" | "failed";
  error?: string;
};
export type SavedCourse = {
  id: string;
  pack: CoursePack;
  savedAt: string;
  cache: string;
};
const PREFIX = "mela-course-";
const DB = "mela-learning-v1";
export async function digest(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("courses", { keyPath: "id" });
      r.result.createObjectStore("downloads", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(new Error("Device storage is unavailable."));
  });
}
async function query<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const d = await database();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = run(t.objectStore(store));
    let result: T;
    r.onsuccess = () => {
      result = r.result;
    };
    t.oncomplete = () => {
      d.close();
      resolve(result);
    };
    t.onerror = t.onabort = () => {
      d.close();
      reject(
        new Error(
          "Could not save this course. Check available device storage.",
        ),
      );
    };
  });
}
export const listSaved = () =>
  query<SavedCourse[]>("courses", "readonly", (s) => s.getAll());
export const getSaved = (id: string) =>
  query<SavedCourse | undefined>("courses", "readonly", (s) => s.get(id));
export const listDownloads = () =>
  query<DownloadState[]>("downloads", "readonly", (s) => s.getAll());
export const saveState = (state: DownloadState) =>
  query("downloads", "readwrite", (s) => s.put(state));
export async function verifyPack(value: unknown): Promise<CoursePack> {
  const p = value as CoursePack;
  if (
    !p ||
    p.version !== 1 ||
    !/^[-a-z0-9]{1,80}$/.test(p.id) ||
    !/^[a-f0-9]{64}$/.test(p.revision) ||
    typeof p.title !== "string" ||
    !Array.isArray(p.sections) ||
    !p.sections.length ||
    p.sections.length > 1000 ||
    !Array.isArray(p.resources) ||
    p.resources.length > 200 ||
    !Array.isArray(p.practice)
  )
    throw new Error("Invalid course pack.");
  for (const s of p.sections)
    if (
      typeof s.id !== "string" ||
      typeof s.title !== "string" ||
      typeof s.content !== "string" ||
      s.content.length > 6000 ||
      s.courseId !== p.id ||
      typeof s.url !== "string" ||
      !s.url.startsWith("/savanna/pages/")
    )
      throw new Error("Invalid course section.");
  for (const q of p.practice)
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      q.options.length > 8 ||
      !q.options.every((v) => typeof v === "string") ||
      !Number.isInteger(q.correct) ||
      q.correct < 0 ||
      q.correct >= q.options.length ||
      typeof q.rationale !== "string" ||
      !p.sections.some((s) => s.id === q.sourceId)
    )
      throw new Error("Invalid practice question.");
  if (
    (await digest(
      JSON.stringify({
        sections: p.sections,
        resources: p.resources,
        practice: p.practice,
      }),
    )) !== p.revision
  )
    throw new Error(
      "The course content is incomplete or has changed. Please retry.",
    );
  for (const r of p.resources) {
    const url = new URL(r.url, location.origin);
    if (
      url.origin !== location.origin ||
      !/^\/(courses|transcripts|fonts)\//.test(url.pathname) ||
      !/^[a-f0-9]{64}$/.test(r.sha256) ||
      !Number.isSafeInteger(r.bytes) ||
      r.bytes < 0 ||
      r.bytes > 128 * 1024 * 1024
    )
      throw new Error("Unsupported course resource.");
  }
  return p;
}
export async function downloadCourse(
  id: string,
  signal: AbortSignal,
  onProgress: (s: DownloadState) => void,
) {
  if (!/^[-a-z0-9]{1,80}$/.test(id)) throw new Error("Invalid course.");
  const response = await fetch("/courses/" + id + ".json", {
    signal,
    cache: "no-cache",
  });
  if (!response.ok) throw new Error("The course is unavailable.");
  const pack = await verifyPack(await response.json());
  if (pack.id !== id) throw new Error("Wrong course pack.");
  const state: DownloadState = {
    id,
    revision: pack.revision,
    completed: 0,
    total: pack.resources.length + 1,
    state: "downloading",
  };
  const report = async () => {
    onProgress({ ...state });
    await saveState(state);
  };
  const cacheName = PREFIX + id + "-" + pack.revision;
  try {
    const estimate = await navigator.storage?.estimate();
    const bytes =
      new TextEncoder().encode(JSON.stringify(pack)).length +
      pack.resources.reduce((n, r) => n + r.bytes, 0);
    if (
      estimate?.quota &&
      estimate.usage !== undefined &&
      estimate.quota - estimate.usage < bytes * 1.2
    )
      throw new Error(
        "Not enough device storage. Remove a saved course and retry.",
      );
    const cache = await caches.open(cacheName);
    await report();
    for (const resource of pack.resources) {
      signal.throwIfAborted();
      const validResource = async (response: Response) => {
        const data = await response.clone().arrayBuffer();
        return (
          data.byteLength === resource.bytes &&
          Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("") === resource.sha256
        );
      };
      let saved = await cache.match(resource.url);
      if (saved && !(await validResource(saved))) {
        await cache.delete(resource.url);
        saved = undefined;
      }
      if (!saved) {
        saved = await fetch(resource.url, { signal, credentials: "omit" });
        if (!saved.ok) throw new Error("A course resource is unavailable.");
        if (!(await validResource(saved)))
          throw new Error(
            "Resource verification failed. Retry online to get a complete file.",
          );
      }
      await cache.put(resource.url, saved);
      state.completed++;
      await report();
    }
    signal.throwIfAborted();
    const old = await getSaved(id);
    await query("courses", "readwrite", (s) =>
      s.put({
        id,
        pack,
        savedAt: new Date().toISOString(),
        cache: cacheName,
      } satisfies SavedCourse),
    );
    state.completed = state.total;
    state.state = "ready";
    await report();
    if (old && old.cache !== cacheName) await caches.delete(old.cache);
    void navigator.storage?.persist?.().catch(() => false);
    return pack;
  } catch (error) {
    state.state = signal.aborted ? "cancelled" : "failed";
    state.error = signal.aborted
      ? "Download cancelled. Retry to resume verified resources."
      : error instanceof Error
        ? error.message
        : "Download failed.";
    await report().catch(() => {});
    throw error;
  }
}
export async function removeCourse(id: string) {
  const saved = await getSaved(id);
  await query("courses", "readwrite", (s) => s.delete(id));
  await query("downloads", "readwrite", (s) => s.delete(id));
  for (const name of await caches.keys())
    if (name.startsWith(PREFIX + id + "-")) await caches.delete(name);
  return !!saved;
}

export async function savedResourcesReady(saved: SavedCourse) {
  if (!(await caches.keys()).includes(saved.cache))
    return saved.pack.resources.length === 0;
  const cache = await caches.open(saved.cache);
  for (const r of saved.pack.resources) {
    if (!(await cache.match(r.url))) return false;
  }
  return true;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_KEY,
  MAX_PAGES,
  MAX_SITES,
  MAX_BYTES,
  RETENTION_MS,
  publicPageUrl,
  savePage,
  pruneMemory,
  searchSiteMemory,
  type MemoryStore,
  type SiteView,
} from "../../extension/memory/model";
import {
  createMemoryService,
  type MemoryStorage,
} from "../../extension/memory/service";
import { capturePage } from "../../extension/memory/capture";
const now = 1800000000000,
  extensionId = "test-extension",
  managerUrl = "chrome-extension://test-extension/options.html";
const sender = (url = "https://learn.example/course") => ({
  id: extensionId,
  url,
  frameId: 0,
  tab: { url, incognito: false },
});
const manager = { id: extensionId, url: managerUrl };
const page = (
  url = "https://learn.example/course",
  text = "Quantization reduces the precision of model weights to make a smaller model.",
) => ({ url, title: "Quantization lesson", text, headings: ["Quantization"] });
function storage() {
  let data: Record<string, unknown> = {};
  const api: MemoryStorage = {
    get: async () => structuredClone(data),
    set: async (value) => {
      data = { ...data, ...structuredClone(value) };
    },
  };
  return { api, read: () => data };
}
const message = (action: string, extra: Record<string, unknown> = {}) => ({
  type: "mela:memory",
  action,
  ...extra,
});
test("URL keys discard query/fragment state and reject credentials or sensitive workflows", () => {
  assert.equal(
    publicPageUrl("https://learn.example/course?week=1#notes"),
    "https://learn.example/course",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://me:secret@learn.example/course",
    "https://learn.example/account/balance",
    "https://learn.example/login",
    "https://learn.example/dashboard",
    "https://learn.example/course?token=private",
    "https://learn.example/course?email=private",
  ])
    assert.throws(() => publicPageUrl(url));
});
test("site memory is off by default; approved text survives a new background-service instance", async () => {
  const disk = storage();
  const first = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  const initial = (await first.handle(message("site"), sender())) as SiteView;
  assert.equal(initial.enabled, false);
  assert.deepEqual(initial.pages, []);
  await first.handle(message("visit", { page: page() }), sender());
  assert.equal(
    ((await first.handle(message("site"), sender())) as SiteView).pageCount,
    0,
  );
  await first.handle(message("remember", { page: page() }), sender());
  const restarted = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now + 1000,
  );
  const view = (await restarted.handle(message("site"), sender())) as SiteView;
  assert.equal(view.enabled, true);
  assert.equal(view.pages[0].text, page().text);
  assert.equal(view.pages[0].savedAt, now);
});
test("later approved visits refresh a URL rather than duplicating it", async () => {
  const disk = storage();
  let clock = now;
  const service = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => clock,
  );
  await service.handle(
    message("remember", { page: page("https://learn.example/course?week=1") }),
    sender(),
  );
  clock++;
  await service.handle(
    message("visit", {
      page: page(
        "https://learn.example/course?week=2",
        "Updated quantization explanation.",
      ),
    }),
    sender(),
  );
  const view = (await service.handle(message("site"), sender())) as SiteView;
  assert.equal(view.pages.length, 1);
  assert.equal(view.pages[0].visits, 2);
  assert.equal(view.pages[0].text, "Updated quantization explanation.");
  assert.equal(view.pages[0].firstSavedAt, now);
});
test("paused sites neither save visits nor supply remembered evidence; resume and forget work", async () => {
  const disk = storage();
  const service = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  await service.handle(message("remember", { page: page() }), sender());
  await service.handle(message("toggle", { enabled: false }), sender());
  await service.handle(
    message("visit", {
      page: page(
        "https://learn.example/another",
        "Do not save this while paused.",
      ),
    }),
    sender(),
  );
  const paused = (await service.handle(message("site"), sender())) as SiteView;
  assert.equal(paused.pageCount, 1);
  assert.deepEqual(paused.pages, []);
  assert.deepEqual(searchSiteMemory("quantization", paused), []);
  await service.handle(message("toggle", { enabled: true }), sender());
  assert.equal(
    ((await service.handle(message("site"), sender())) as SiteView).pages
      .length,
    1,
  );
  await service.handle(message("forget"), sender());
  assert.equal(
    ((await service.handle(message("site"), sender())) as SiteView).pageCount,
    0,
  );
});
test("page scripts cannot choose another origin, list all sites, clear all data or write mismatched URLs", async () => {
  const disk = storage();
  const service = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  await service.handle(message("remember", { page: page() }), sender());
  const different = (await service.handle(
    message("site", { origin: "https://learn.example" }),
    sender("https://other.example/page"),
  )) as SiteView;
  assert.equal(different.origin, "https://other.example");
  assert.equal(different.pages.length, 0);
  await assert.rejects(
    service.handle(
      message("remember", { page: page("https://other.example/page") }),
      sender(),
    ),
    /active website/,
  );
  await assert.rejects(service.handle(message("list"), sender()), /manager/);
  await assert.rejects(service.handle(message("clear"), sender()), /manager/);
  await assert.rejects(
    service.handle(message("site"), { ...sender(), id: "other-extension" }),
    /unavailable/,
  );
  await assert.rejects(
    service.handle(message("site"), { ...sender(), frameId: 1 }),
    /main page/,
  );
});
test("incognito contexts cannot read or save persistent site memory", async () => {
  const disk = storage();
  const service = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  const privateSender = {
    ...sender(),
    tab: { url: "https://learn.example/course", incognito: true },
  };
  await assert.rejects(
    service.handle(message("site"), privateSender),
    /unavailable/,
  );
  await assert.rejects(
    service.handle(message("remember", { page: page() }), privateSender),
    /unavailable/,
  );
  assert.equal(disk.read()[MEMORY_KEY], undefined);
});
test("the extension manager reviews paused pages and removes one page or all sites", async () => {
  const disk = storage();
  const service = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  await service.handle(message("remember", { page: page() }), sender());
  await service.handle(message("toggle", { enabled: false }), sender());
  const all = (await service.handle(message("list"), manager)) as MemoryStore;
  assert.equal(all.sites[0].pages.length, 1);
  await service.handle(
    message("remove-page", {
      origin: "https://learn.example",
      url: "https://learn.example/course",
    }),
    manager,
  );
  assert.equal(
    ((await service.handle(message("list"), manager)) as MemoryStore).sites[0]
      .pages.length,
    0,
  );
  await service.handle(message("clear"), manager);
  assert.deepEqual(
    ((await service.handle(message("list"), manager)) as MemoryStore).sites,
    [],
  );
});
test("serialized updates from multiple tabs retain both pages and a failed write is not reported as saved", async () => {
  const disk = storage();
  const service = createMemoryService(
    disk.api,
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  await Promise.all([
    service.handle(
      message("remember", { page: page("https://learn.example/one") }),
      sender(),
    ),
    service.handle(
      message("remember", { page: page("https://learn.example/two") }),
      sender(),
    ),
  ]);
  assert.equal(
    ((await service.handle(message("site"), sender())) as SiteView).pages
      .length,
    2,
  );
  const broken = createMemoryService(
    {
      get: disk.api.get,
      set: async () => {
        throw new Error("quota");
      },
    },
    extensionId,
    managerUrl,
    async () => {},
    () => now,
  );
  await assert.rejects(
    broken.handle(
      message("remember", { page: page("https://learn.example/three") }),
      sender(),
    ),
    /quota/,
  );
  assert.equal(
    ((await service.handle(message("site"), sender())) as SiteView).pages
      .length,
    2,
  );
});
test("memory has bounded pages, sites, text and age, with a total storage budget", () => {
  let store: MemoryStore = { version: 1, sites: [] };
  for (let i = 0; i < MAX_PAGES + 4; i++)
    store = savePage(
      store,
      "https://learn.example",
      page("https://learn.example/" + i),
      now + i,
    );
  assert.equal(store.sites[0].pages.length, MAX_PAGES);
  assert.equal(store.sites[0].pages[0].url, "https://learn.example/13");
  for (let i = 0; i < MAX_SITES + 2; i++)
    store = savePage(
      store,
      "https://site" + i + ".example",
      page("https://site" + i + ".example/course", "አ".repeat(20000)),
      now + 100 + i,
    );
  assert.equal(store.sites.length, MAX_SITES);
  assert.ok(
    store.sites.every((s) => s.pages.every((p) => p.text.length <= 12000)),
  );
  assert.ok(
    new TextEncoder().encode(JSON.stringify(store)).byteLength <= MAX_BYTES,
  );
  assert.equal(pruneMemory(store, now + RETENTION_MS + 1000).sites.length, 0);
  assert.deepEqual(pruneMemory({ version: 999, sites: [] }, now).sites, []);
});
test("answers retrieve source evidence only from the current site and prefer fresh text for the same URL", () => {
  const store = savePage(
    { version: 1, sites: [] },
    "https://learn.example",
    page(),
    now,
  );
  const view: SiteView = {
    origin: "https://learn.example",
    enabled: true,
    pageCount: 1,
    pages: store.sites[0].pages,
  };
  assert.equal(searchSiteMemory("quantization", view)[0].current, false);
  assert.equal(
    searchSiteMemory(
      "quantization",
      view,
      page(undefined, "Quantization now uses a revised explanation."),
    )[0].current,
    true,
  );
  assert.equal(searchSiteMemory("unrelated astronomy", view).length, 0);
  const contaminated = {
    ...view,
    pages: [
      ...view.pages,
      {
        ...view.pages[0],
        url: "https://other.example/course",
        text: "Secret astronomy context.",
      },
    ],
  };
  assert.equal(searchSiteMemory("astronomy", contaminated).length, 0);
});
test("capture excludes form values, private/hidden regions, assistant UI and hidden heading text", async () => {
  const { parseHTML } = await import("linkedom");
  const { document } = parseHTML(
    '<html><body><main><h1>Course <span data-private>HIDDEN_TITLE</span></h1><p>Public quantization lesson.</p><form><label>PRIVATE_FORM</label><input value="PRIVATE_VALUE"></form><p data-private>PRIVATE_TEXT</p><p hidden>HIDDEN_TEXT</p><p style="display:none">CSS_HIDDEN</p><p style="opacity:0">TRANSPARENT_HIDDEN</p><aside data-mela-actions-ui>ASSISTANT_UI</aside><h2>Practice</h2></main></body></html>',
  );
  const prior = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: (element: HTMLElement) => ({
      display: element.style.display,
      visibility: element.style.visibility,
      opacity: element.style.opacity,
    }),
  });
  try {
    const captured = capturePage(
      document,
      "https://learn.example/course?week=2#lesson",
    );
    assert.equal(captured.url, "https://learn.example/course");
    assert.equal(captured.title, "Course");
    assert.match(captured.text, /Public quantization lesson/);
    assert.doesNotMatch(
      JSON.stringify(captured),
      /PRIVATE_|HIDDEN_|CSS_HIDDEN|TRANSPARENT_HIDDEN|ASSISTANT_UI/,
    );
  } finally {
    if (prior) Object.defineProperty(globalThis, "getComputedStyle", prior);
    else Reflect.deleteProperty(globalThis, "getComputedStyle");
  }
});

test("the background bridge restricts storage access and replies asynchronously without exposing raw errors", async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const calls: string[] = [];
  let listener:
    | ((
        message: unknown,
        sender: unknown,
        reply: (value: unknown) => void,
      ) => boolean | undefined)
    | undefined;
  const disk = storage();
  const fake = {
    runtime: {
      id: extensionId,
      getURL: () => managerUrl,
      openOptionsPage: async () => {},
      sendMessage: async () => ({ ok: true }),
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    },
    storage: {
      local: {
        get: async (key: string) => {
          calls.push("get");
          return disk.api.get(key);
        },
        set: disk.api.set,
        setAccessLevel: async (options: { accessLevel: string }) => {
          assert.equal(options.accessLevel, "TRUSTED_CONTEXTS");
          calls.push("restrict");
        },
      },
    },
    action: {
      onClicked: { addListener: () => {} },
      setBadgeText: async () => {},
      setTitle: async () => {},
    },
    scripting: { executeScript: async () => [] },
  };
  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: fake,
  });
  try {
    await import("../../extension/background");
    assert.ok(listener);
    const response = await new Promise<{ ok: boolean; value: SiteView }>(
      (resolve) => {
        assert.equal(
          listener!(message("site"), sender(), (value) =>
            resolve(value as { ok: boolean; value: SiteView }),
          ),
          true,
        );
      },
    );
    assert.equal(response.ok, true);
    assert.equal(response.value.origin, "https://learn.example");
    assert.deepEqual(calls.slice(0, 2), ["restrict", "get"]);
    const bad = await new Promise<{ ok: boolean; error: string }>((resolve) => {
      listener!(message("site"), { ...sender(), id: "attacker" }, (value) =>
        resolve(value as { ok: boolean; error: string }),
      );
    });
    assert.equal(bad.ok, false);
    assert.doesNotMatch(bad.error, /attacker|test-extension/);
  } finally {
    if (prior) Object.defineProperty(globalThis, "chrome", prior);
    else Reflect.deleteProperty(globalThis, "chrome");
  }
});

test("late site-context answers cannot overwrite Stop, and extension mode keeps its UI in a closed shadow root", async () => {
  const { parseHTML } = await import("linkedom");
  const { mountActions } = await import("../../module/actions/panel");
  const { window } = parseHTML(
    "<html><body><main><h1>Public lesson</h1></main></body></html>",
  );
  const globals = {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Event: window.Event,
  };
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const selectDescriptor = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  );
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() {
      return this.getAttribute("data-value") || "";
    },
    set(value) {
      this.setAttribute("data-value", value);
    },
  });
  let resolveAnswer: (answer: {
    status: "done";
    message: string;
  }) => void = () => {};
  const pending = new Promise<{ status: "done"; message: string }>(
    (resolve) => {
      resolveAnswer = resolve;
    },
  );
  try {
    const panel = mountActions({
      api: "https://mela.example/api/v1",
      question: () => pending,
    });
    const shadow = panel.element.shadowRoot!;
    (shadow.querySelector("textarea") as HTMLTextAreaElement).value =
      "What is quantization?";
    const buttons = Array.from(shadow.querySelectorAll("button"));
    buttons.find((b) => b.textContent === "Run command")!.click();
    assert.match(
      shadow.querySelector("[role=status]")!.textContent || "",
      /Searching/,
    );
    buttons.find((b) => b.textContent === "Stop")!.click();
    resolveAnswer({ status: "done", message: "Old saved answer" });
    await Promise.resolve();
    await Promise.resolve();
    assert.match(
      shadow.querySelector("[role=status]")!.textContent || "",
      /Stopped/,
    );
    assert.doesNotMatch(
      shadow.querySelector("[role=status]")!.textContent || "",
      /Old saved answer/,
    );
    panel.destroy();
    const closed = mountActions({
      api: "https://mela.example/api/v1",
      shadowMode: "closed",
    });
    assert.equal(closed.element.shadowRoot, null);
    closed.destroy();
  } finally {
    if (selectDescriptor)
      Object.defineProperty(
        window.HTMLSelectElement.prototype,
        "value",
        selectDescriptor,
      );
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
  }
});

test("explicit recall shows saved pages without inventing a browsing history or using paused context", () => {
  const stored = savePage(
    { version: 1, sites: [] },
    "https://learn.example",
    page(),
    now,
  );
  const view: SiteView = {
    origin: "https://learn.example",
    enabled: true,
    pageCount: 1,
    pages: stored.sites[0].pages,
  };
  const hits = searchSiteMemory(
    "What do you remember?",
    view,
    page("https://learn.example/new", "Unsaved live page."),
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].current, false);
  assert.equal(hits[0].url, "https://learn.example/course");
  assert.deepEqual(
    searchSiteMemory("Continue from last time", { ...view, enabled: false }),
    [],
  );
});

test("total-byte pruning removes the oldest context even before site and page-count limits are reached", () => {
  const raw: MemoryStore = {
    version: 1,
    sites: Array.from({ length: 7 }, (_, i) => ({
      origin: `https://site${i}.example`,
      enabled: true,
      updatedAt: now,
      pages: Array.from({ length: 10 }, (_, j) => ({
        ...page(`https://site${i}.example/${j}`, "አ".repeat(12000)),
        savedAt: now - i * 10 - j,
        firstSavedAt: now - i * 10 - j,
        visits: 1,
      })),
    })),
  };
  assert.ok(
    new TextEncoder().encode(JSON.stringify(raw)).byteLength > MAX_BYTES,
  );
  const clean = pruneMemory(raw, now);
  assert.ok(
    new TextEncoder().encode(JSON.stringify(clean)).byteLength <= MAX_BYTES,
  );
  assert.ok(clean.sites.flatMap((s) => s.pages).length < 70);
  assert.ok(
    clean.sites[0].pages.some((p) => p.url === "https://site0.example/0"),
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { POST as ask } from "../app/api/v1/ask/route.ts";
const bundle = readFileSync("public/db-assistant.js", "utf8");
const content = JSON.parse(readFileSync("data/content.json", "utf8"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function setup({ html = "", lang = "en", offline = false, answer } = {}) {
  const { window } = parseHTML(
    `<html><body><main data-mela-context data-course-id="digital-foundations" data-lesson-title="First lesson">${html}</main></body></html>`,
  );
  // linkedom models selects as read-only; browsers support both accessors.
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() {
      return (
        this.getAttribute("data-value") ||
        this.querySelector("option")?.value ||
        ""
      );
    },
    set(value) {
      this.setAttribute("data-value", value);
    },
  });
  const calls = [];
  const store = new Map();
  const navigator = { onLine: !offline };
  const fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (String(url).includes("content.json")) return Response.json(content);
    if (String(url).endsWith("/ask")) {
      if (!navigator.onLine) throw new Error("offline");
      return answer
        ? answer(url, init)
        : ask(
            new Request("http://localhost:3000" + url, {
              ...init,
              headers: { ...init.headers, origin: "http://localhost:3000" },
            }),
          );
    }
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  };
  const sandbox = {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    customElements: window.customElements,
    MutationObserver: window.MutationObserver,
    CustomEvent: window.CustomEvent,
    URL,
    AbortController,
    AbortSignal,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    navigator,
    location: {
      href: "http://localhost:3000/learn",
      origin: "http://localhost:3000",
    },
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
    },
    fetch,
  };
  window.speechSynthesis = { cancel() {} };
  vm.createContext(sandbox);
  vm.runInContext(bundle, sandbox);
  const widget = window.document.createElement("db-assistant");
  widget.setAttribute("lang", lang);
  widget.setAttribute("api", "/api");
  window.document.body.append(widget);
  return {
    window,
    widget,
    root: widget.shadowRoot,
    calls,
    navigator,
    cleanup: () => widget.remove(),
  };
}
async function question(fixture, text) {
  fixture.root.querySelector(".launcher").click();
  const input = fixture.root.querySelector("textarea");
  input.value = text;
  fixture.root
    .querySelector("form")
    .dispatchEvent(new fixture.window.Event("submit", { cancelable: true }));
  await wait(50);
}
test("standalone widget mounts in Shadow DOM, answers with real API and emits private-safe event", async () => {
  const f = setup();
  try {
    let detail;
    f.widget.addEventListener(
      "db-assistant:question",
      (e) => (detail = e.detail),
    );
    await question(f, "password");
    assert.match(
      f.root.querySelector(".messages").textContent,
      /unique password/,
    );
    assert.ok(f.root.querySelector(".sources a"));
    assert.equal(detail.language, "en");
    assert.equal(detail.question, undefined);
    assert.equal(f.window.document.querySelector(".panel"), null);
    assert.equal(
      f.calls.filter((c) => String(c.url).includes("ask")).length,
      1,
    );
  } finally {
    f.cleanup();
  }
});
test("Amharic interface answers with Amharic sources", async () => {
  const f = setup({ lang: "am" });
  try {
    await question(f, "የይለፍ ቃል");
    assert.match(f.root.querySelector(".messages").textContent, /ረጅምና/);
    assert.equal(f.root.querySelector(".panel").lang, "am");
  } finally {
    f.cleanup();
  }
});
test("offline fallback searches public content cached in memory", async () => {
  const f = setup();
  try {
    await wait(10);
    f.navigator.onLine = false;
    await question(f, "browser");
    assert.match(
      f.root.querySelector(".messages").textContent,
      /application for opening websites/,
    );
    assert.match(f.root.querySelector(".status").textContent, /Offline/);
  } finally {
    f.cleanup();
  }
});
test("page extraction excludes private descendants and form values", async () => {
  const f = setup({
    html: '<section id="approved" data-mela-section><h2>Password lesson</h2><p data-mela-content>Use a long password. <span data-private>PRIVATE_SECRET</span></p><form>FORM_SECRET</form></section>',
  });
  try {
    await question(f, "password");
    const payload = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    assert.equal(payload.context.sections[0].id, "approved");
    assert.ok(!JSON.stringify(payload).includes("PRIVATE_SECRET"));
    assert.ok(!JSON.stringify(payload).includes("FORM_SECRET"));
  } finally {
    f.cleanup();
  }
});
test("context changes suppress stale answers without clearing chat", async () => {
  let resolveAnswer;
  const f = setup({
    answer: () =>
      new Promise((resolve) => {
        resolveAnswer = resolve;
      }),
  });
  try {
    await question(f, "password");
    f.window.document
      .querySelector("main")
      .setAttribute("data-lesson-title", "Second lesson");
    await wait(300);
    resolveAnswer(
      Response.json({
        answer: "STALE_ANSWER",
        citations: [],
        provider: "none",
        matched: true,
        actions: [],
      }),
    );
    await wait(20);
    assert.equal(f.root.querySelector(".context").textContent, "Second lesson");
    assert.ok(
      !f.root.querySelector(".messages").textContent.includes("STALE_ANSWER"),
    );
    assert.match(f.root.querySelector(".messages").textContent, /password/);
  } finally {
    f.cleanup();
  }
});
test("human help requires consent and presents a sharing preview", async () => {
  const f = setup();
  try {
    f.root.querySelector(".launcher").click();
    f.root.querySelector(".footer button").click();
    assert.ok(f.root.querySelector(".help-view"));
    assert.match(
      f.root.querySelector(".help-view pre").textContent,
      /No information selected/,
    );
    f.root.querySelector(".help-view .send").click();
    await wait(10);
    assert.equal(
      f.calls.some((c) => String(c.url).includes("escalations")),
      false,
    );
    assert.match(
      f.root.querySelector(".help-view").textContent,
      /I agree to share/,
    );
  } finally {
    f.cleanup();
  }
});

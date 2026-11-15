import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { POST as ask } from "../app/api/v1/ask/route.ts";
const bundle = readFileSync("public/db-assistant.js", "utf8");
const content = JSON.parse(readFileSync("data/content.json", "utf8"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function setup({
  html = "",
  lang = "en",
  offline = false,
  answer,
  fullPage,
  integration = false,
  extraFetch,
} = {}) {
  const { window } = parseHTML(
    fullPage ||
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
    if (extraFetch) {
      const response = await extraFetch(url, init);
      if (response) return response;
    }
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
    matchMedia: () => ({ matches: true }),
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
  if (integration)
    vm.runInContext(
      readFileSync("public/savanna-integration.js", "utf8"),
      sandbox,
    );
  const widget =
    window.document.querySelector("db-assistant") ||
    window.document.createElement("db-assistant");
  if (!widget.isConnected) {
    widget.setAttribute("lang", lang);
    widget.setAttribute("api", "/api");
    window.document.body.append(widget);
  }
  return {
    window,
    widget,
    root: widget.shadowRoot,
    calls,
    navigator,
    sandbox,
    cleanup: () => {
      window.document
        .querySelectorAll("mela-course-media")
        .forEach((node) => node.remove());
      widget.remove();
    },
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
test("original Savanna lesson mounts docked English support and extracts authored course text", async () => {
  const f = setup({
    fullPage: readFileSync(
      "public/savanna/pages/concept-with-navigation.html",
      "utf8",
    ),
    integration: true,
  });
  try {
    assert.equal(f.widget.getAttribute("mode"), "docked");
    assert.equal(f.widget.getAttribute("lang"), "en");
    assert.ok(!f.root.querySelector(".panel").classList.contains("hidden"));
    assert.match(
      f.root.querySelector(".context").textContent,
      /Future of the VA Industry/,
    );
    await question(f, "What is changing virtual assistant work?");
    const body = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    assert.equal(body.context.courseId, "va-foundations");
    assert.ok(body.context.sections.length >= 3);
    assert.ok(
      body.context.sections.some((s) => s.content.includes("Artificial")),
    );
    assert.ok(f.root.querySelector(".sources a"));
    assert.ok(f.window.document.querySelector("#sidebar"));
  } finally {
    f.cleanup();
  }
});
test("video transcript joins current-page context with timestamped source links", async () => {
  const f = setup({
    fullPage: readFileSync(
      "public/savanna/pages/concept-with-navigation.html",
      "utf8",
    ),
    integration: true,
  });
  try {
    const media = f.window.document.querySelector("mela-course-media");
    media.dispatchEvent(
      new f.window.CustomEvent("mela:transcript-ready", {
        bubbles: true,
        detail: {
          videoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
          cues: [
            {
              start: 12,
              end: 16,
              text: "Video evidence about a unique video-only skill.",
            },
          ],
        },
      }),
    );
    await wait(300);
    await question(f, "Explain this video");
    const body = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    const section = body.context.sections.find((s) =>
      s.id.startsWith("video-"),
    );
    assert.match(section.content, /video-only/);
    assert.match(section.url, /t=12/);
    assert.match(f.root.querySelector(".messages").textContent, /video-only/);
  } finally {
    f.cleanup();
  }
});
test("course player presents English transcript and an honest sign-language square without loading YouTube automatically", async () => {
  const f = setup({
    extraFetch: async (url) =>
      String(url).includes("/media")
        ? Response.json({
            defaultVideoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
            signLanguage: null,
          })
        : undefined,
  });
  try {
    vm.runInContext(readFileSync("public/course-media.js", "utf8"), f.sandbox);
    const media = f.window.document.createElement("mela-course-media");
    f.window.document.body.append(media);
    await wait(10);
    assert.equal(media.shadowRoot.querySelector("iframe"), null);
    assert.match(
      media.shadowRoot.querySelector(".sign-box").textContent,
      /No validated signing video/,
    );
    assert.match(
      media.shadowRoot.querySelector(".card").textContent,
      /Generate English transcript/,
    );
    media.shadowRoot.querySelector(".primary").click();
    await wait(10);
    assert.equal(
      f.calls.some((c) => String(c.url).includes("transcriptions")),
      false,
    );
    assert.match(
      media.shadowRoot.querySelector(".status").textContent,
      /sharing choice/,
    );
  } finally {
    f.cleanup();
  }
});
test("course player requests and displays an English video transcript after consent", async () => {
  const f = setup({
    extraFetch: async (url) =>
      String(url).includes("/media")
        ? Response.json({
            defaultVideoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
            signLanguage: null,
          })
        : String(url).endsWith("/transcriptions")
          ? Response.json({
              title: "Example",
              videoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
              language: "en",
              generated: true,
              cues: [
                { start: 0, end: 4, text: "A timestamped English transcript." },
              ],
            })
          : undefined,
  });
  try {
    f.window.YT = {
      Player: class {
        getCurrentTime() {
          return 0;
        }
        getPlayerState() {
          return 2;
        }
        getPlaybackRate() {
          return 1;
        }
        seekTo() {}
        destroy() {}
      },
    };
    vm.runInContext(readFileSync("public/course-media.js", "utf8"), f.sandbox);
    const media = f.window.document.createElement("mela-course-media");
    f.window.document.body.append(media);
    await wait(10);
    media.shadowRoot.querySelector("input[type=checkbox]").checked = true;
    media.shadowRoot.querySelector(".primary").click();
    await wait(50);
    const call = f.calls.find((c) => String(c.url).endsWith("/transcriptions"));
    assert.ok(call);
    assert.equal(JSON.parse(call.init.body).language, "en");
    assert.equal(JSON.parse(call.init.body).consent, true);
    assert.match(
      media.shadowRoot.querySelector(".cues").textContent,
      /timestamped English/,
    );
    assert.ok(media.shadowRoot.querySelector("iframe"));
    assert.match(
      media.shadowRoot.querySelector(".status").textContent,
      /AI-generated/,
    );
  } finally {
    f.cleanup();
  }
});
test("supplied 18-slide training uses the real Savanna shell and answers offline from its page", async () => {
  const f = setup({
    fullPage: readFileSync(
      "public/savanna/pages/offline-first-localized-ai.html",
      "utf8",
    ),
    integration: true,
  });
  try {
    assert.equal(
      f.window.document.querySelectorAll(".mela-training-slide").length,
      18,
    );
    assert.match(
      f.window.document.querySelector(".savanna-styles").textContent,
      /Kidus Yohannes/,
    );
    assert.ok(f.window.document.querySelector("#offline-ai-slide-16 details"));
    assert.match(f.root.querySelector(".context").textContent, /Offline-First/);
    f.navigator.onLine = false;
    await question(f, "What is quantization?");
    assert.match(f.root.querySelector(".messages").textContent, /4-bit/);
    assert.match(f.root.querySelector(".status").textContent, /Offline/);
    assert.ok(f.root.querySelector('.sources a[href*="offline-ai-slide-07"]'));
  } finally {
    f.cleanup();
  }
});
test("module changes on the captured Savanna homepage refresh the assistant scope", async () => {
  const f = setup({
    fullPage: readFileSync(
      "public/savanna/pages/homepage-v1-self-paced.html",
      "utf8",
    ),
    integration: true,
  });
  try {
    const buttons = [
      ...f.window.document.querySelectorAll("button[data-section-index]"),
    ];
    assert.ok(buttons.length > 1);
    buttons.forEach((b) => b.classList.remove("bg-light"));
    buttons[1].classList.add("bg-light");
    const host = f.window.document.querySelector("[data-section-host]");
    const p = f.window.document.createElement("p");
    p.textContent = "The newly selected module teaches a different activity.";
    host.replaceChildren(p);
    await wait(300);
    await question(f, "Explain my current lesson");
    const body = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    assert.equal(body.context.moduleTitle, buttons[1].textContent.trim());
    assert.ok(
      body.context.sections.some((s) =>
        s.content.includes("newly selected module"),
      ),
    );
  } finally {
    f.cleanup();
  }
});
test("the original paced Savanna page exposes only its currently rendered week", async () => {
  const f = setup({
    fullPage: readFileSync(
      "public/savanna/pages/homepage-v1-paced.html",
      "utf8",
    ),
    integration: true,
  });
  try {
    await question(f, "Explain my current lesson");
    const data = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    assert.equal(data.context.pageType, "dashboard");
    assert.equal(data.context.courseId, "wr-100");
    assert.ok(data.context.sections.length > 0);
    assert.ok(data.context.sections.length < 10);
    assert.ok(
      !data.context.sections.some((s) =>
        s.content.includes("static-track-store"),
      ),
    );
  } finally {
    f.cleanup();
  }
});

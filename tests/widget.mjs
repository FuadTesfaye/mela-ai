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
    TextEncoder,
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
          video: {
            videoId: "9hE5-98ZeCg",
            url: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
            title: "Example",
            currentTime: 12,
            duration: 120,
            transcriptRevision: "test-v1",
          },
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
      /AI captions.*experimental avatar/,
    );
    assert.match(
      media.shadowRoot.querySelector(".card").textContent,
      /Generate AI captions/,
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
test("playback ticks do not cancel an explanation submitted at a fixed timestamp", async () => {
  let release;
  const f = setup({
    fullPage: readFileSync(
      "public/savanna/pages/programming-for-beginners.html",
      "utf8",
    ),
    integration: true,
    answer: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  try {
    const media = f.window.document.querySelector("mela-course-media");
    const video = {
      videoId: "bJzb-RuUcMU",
      url: "https://www.youtube.com/watch?v=bJzb-RuUcMU",
      title: "Programming",
      currentTime: 120,
      duration: 270,
      transcriptRevision: "v1",
    };
    media.dispatchEvent(
      new f.window.CustomEvent("mela:transcript-ready", {
        bubbles: true,
        detail: {
          videoUrl: video.url,
          video,
          cues: [{ start: 110, end: 130, text: "Practice one small idea." }],
        },
      }),
    );
    await wait(250);
    await question(f, "Explain this video");
    assert.ok(release);
    media.dispatchEvent(
      new f.window.CustomEvent("mela:video-state", {
        bubbles: true,
        detail: { ...video, currentTime: 125 },
      }),
    );
    release(
      Response.json({
        answer: "FROZEN_EXPLANATION",
        citations: [],
        provider: "none",
        matched: true,
        actions: [],
      }),
    );
    await wait(20);
    const request = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    assert.equal(request.context.video.currentTime, 120);
    assert.match(
      f.root.querySelector(".messages").textContent,
      /FROZEN_EXPLANATION/,
    );
  } finally {
    f.cleanup();
  }
});
test("diagram explanations render safe SVG and a complete text alternative", async () => {
  const f = setup({
    answer: async () =>
      Response.json({
        answer: "Learn → Practice",
        summary: "A simple path",
        provider: "gemini",
        matched: true,
        actions: [],
        citations: [
          { id: "s", title: "Lesson", url: "/lesson", excerpt: "Practice" },
        ],
        blocks: [
          {
            kind: "diagram",
            title: "Learning",
            description: "Learn then practice",
            nodes: [
              { id: "a", label: "<script>not executable</script>" },
              { id: "b", label: "Practice" },
            ],
            edges: [{ from: "a", to: "b" }],
            sourceIds: ["s"],
          },
        ],
      }),
  });
  try {
    await question(f, "Show a learning diagram");
    assert.ok(f.root.querySelector("svg.explanation-diagram"));
    assert.match(f.root.querySelector("details").textContent, /Practice/);
    assert.equal(f.root.querySelector(".explanation-block script"), null);
    assert.ok(
      [...f.root.querySelectorAll("button")].some(
        (b) => b.textContent === "Expand diagram",
      ),
    );
  } finally {
    f.cleanup();
  }
});

// The real bundled component runs against controllable YouTube/media shims.
// Browser autoplay, decoding and interpreter quality still require a real-device review.
async function signingFixture({ extraFetch, play, motion = false } = {}) {
  const id = "bJzb-RuUcMU";
  const track = {
    url: "/approved-ethsl.webm",
    videoId: id,
    language: "EthSL",
    reviewer: "Fluent reviewer",
    offsetSeconds: 1,
  };
  const f = setup({
    extraFetch: async (url, init) => {
      const overridden = await extraFetch?.(url, init);
      if (overridden) return overridden;
      if (String(url).includes("/media"))
        return Response.json({
          defaultVideoUrl: `https://youtu.be/${id}`,
          signLanguage: track,
        });
    },
  });
  const frames = new Map();
  let nextFrame = 0;
  f.sandbox.matchMedia = () => ({ matches: !motion });
  f.sandbox.requestAnimationFrame = (callback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  };
  f.sandbox.cancelAnimationFrame = (id) => frames.delete(id);
  const source = { time: 0, state: 2, rate: 1 };
  const videos = [];
  let events;
  f.window.YT = {
    Player: class {
      constructor(_frame, options) {
        events = options.events;
      }
      getCurrentTime() {
        return source.time;
      }
      getDuration() {
        return 120;
      }
      getPlayerState() {
        return source.state;
      }
      getPlaybackRate() {
        return source.rate;
      }
      pauseVideo() {
        source.state = 2;
      }
      destroy() {}
    },
  };
  const create = f.window.document.createElement.bind(f.window.document);
  f.window.document.createElement = function (tag, ...args) {
    const node = create(tag, ...args);
    if (tag.toLowerCase() === "video") {
      node.calls = 0;
      node.pauses = 0;
      Object.defineProperties(node, {
        currentTime: { writable: true, value: 0 },
        duration: { writable: true, value: 120 },
        readyState: { writable: true, value: 0 },
        paused: { writable: true, value: true },
        playbackRate: { writable: true, value: 1 },
      });
      node.pause = () => {
        node.paused = true;
        node.pauses++;
      };
      node.play = () => {
        node.calls++;
        if (play) return play(node);
        node.paused = false;
        return Promise.resolve();
      };
      videos.push(node);
    }
    if (tag.toLowerCase() === "dialog") {
      node.showModal = () => node.setAttribute("open", "");
      node.close = () => {
        node.removeAttribute("open");
        node.dispatchEvent(new f.window.Event("close"));
      };
    }
    return node;
  };
  vm.runInContext(readFileSync("public/course-media.js", "utf8"), f.sandbox);
  const media = create("mela-course-media");
  f.window.document.body.append(media);
  await wait(10);
  const root = media.shadowRoot;
  return {
    ...f,
    media,
    root,
    source,
    videos,
    frames,
    async load(url = `https://youtu.be/${id}`) {
      root.querySelector(".url-form input").value = url;
      root
        .querySelector(".url-form")
        .dispatchEvent(new f.window.Event("submit", { cancelable: true }));
      await wait(10);
    },
    state(state, time = source.time) {
      source.state = state;
      source.time = time;
      events.onStateChange({ data: state });
    },
    ready(video = videos.at(-1)) {
      video.readyState = 4;
      video.onloadedmetadata();
    },
    toggle() {
      root.querySelector(".sign-toggle").click();
    },
  };
}
test("signing opens paused, waits for metadata and follows play, seek, speed, buffering and replay", async () => {
  const f = await signingFixture();
  try {
    assert.equal(f.root.querySelector(".sign-box").hidden, true);
    assert.equal(
      f.root.querySelector(".sign-toggle").getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      f.videos.length,
      0,
      "hidden panel must not load an interpreter",
    );
    await f.load();
    f.source.time = 20;
    f.toggle();
    const video = f.videos.at(-1);
    assert.equal(video.calls, 0);
    assert.equal(video.currentTime, 0, "no seek before metadata");
    f.ready();
    assert.equal(video.currentTime, 19);
    assert.equal(video.calls, 0, "opening never starts a paused source");
    f.state(1, 21);
    await wait(0);
    assert.equal(video.currentTime, 20);
    assert.equal(video.paused, false);
    f.source.rate = 1.5;
    f.state(1, 50);
    assert.equal(video.currentTime, 49);
    assert.equal(video.playbackRate, 1.5);
    video.currentTime = 49.3;
    f.state(1, 50);
    assert.equal(video.currentTime, 49.3, "small drift stays untouched");
    f.state(3);
    assert.equal(video.paused, true, "source buffering pauses interpreter");
    f.state(1);
    await wait(0);
    assert.equal(video.paused, false);
    f.state(2);
    assert.equal(video.paused, true);
    f.state(1, 121);
    assert.match(f.root.querySelector(".sign-status").textContent, /ended/);
    assert.equal(video.paused, true);
    f.state(1, 0);
    assert.equal(video.currentTime, 0);
    assert.equal(video.paused, true, "wait for recording offset");
    f.state(1, 2);
    await wait(0);
    assert.equal(video.currentTime, 1);
    assert.equal(video.paused, false);
  } finally {
    f.cleanup();
  }
});
test("opening midway joins immediately; hiding pauses only signing and enlargement preserves the same media", async () => {
  const f = await signingFixture();
  try {
    await f.load();
    f.state(1, 40);
    f.toggle();
    const video = f.videos.at(-1);
    f.ready();
    await wait(0);
    assert.equal(video.currentTime, 39);
    assert.equal(video.paused, false);
    f.toggle();
    assert.equal(video.paused, true);
    assert.equal(f.source.state, 1);
    f.source.time = 65;
    f.toggle();
    await wait(0);
    assert.equal(f.videos.length, 1);
    assert.equal(video.currentTime, 64);
    f.root.querySelector(".expand-sign").click();
    const dialog = f.root.querySelector("dialog");
    assert.ok(dialog.hasAttribute("open"));
    assert.equal(dialog.querySelector("video"), video);
    f.state(1, 70);
    assert.equal(video.currentTime, 69);
    dialog.querySelector("button").click();
    assert.equal(f.root.querySelector("dialog"), null);
    assert.equal(f.root.querySelector(".sign-box video"), video);
    assert.equal(video.currentTime, 69);
    assert.equal(
      f.root.querySelector(".player-layout").classList.contains("with-signing"),
      true,
    );
  } finally {
    f.cleanup();
  }
});
test("signing never overlaps play promises and supplies explicit recovery for autoplay rejection", async () => {
  let reject;
  const f = await signingFixture({
    play: () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
  });
  try {
    await f.load();
    f.toggle();
    f.state(1, 10);
    f.ready();
    const video = f.videos.at(-1);
    f.state(1, 11);
    f.state(1, 12);
    assert.equal(video.calls, 1);
    reject(
      Object.assign(new Error("Permission required"), {
        name: "NotAllowedError",
      }),
    );
    await wait(0);
    f.state(1, 13);
    assert.equal(video.calls, 1, "timer ticks must not retry blocked autoplay");
    const action = f.root.querySelector(".sign-action");
    assert.equal(action.hidden, false);
    assert.equal(action.textContent, "Start interpreter");
    video.play = () => {
      video.calls++;
      video.paused = false;
      return Promise.resolve();
    };
    action.click();
    await wait(0);
    assert.equal(video.calls, 2);
    assert.equal(action.hidden, true);
    assert.equal(video.currentTime, 12);
  } finally {
    f.cleanup();
  }
});
test("late play completion cannot resume a hidden interpreter; media failure has a retry state", async () => {
  let resolve;
  const f = await signingFixture({
    play: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  try {
    await f.load();
    f.toggle();
    f.state(1, 10);
    f.ready();
    const video = f.videos.at(-1);
    f.toggle();
    video.paused = false;
    resolve();
    await wait(0);
    assert.equal(video.paused, true);
    f.toggle();
    video.onerror();
    assert.match(
      f.root.querySelector(".sign-status").textContent,
      /could not be played/,
    );
    const action = f.root.querySelector(".sign-action");
    assert.equal(action.textContent, "Retry signing");
    action.click();
    assert.equal(f.videos.length, 2);
    assert.match(f.root.querySelector(".sign-status").textContent, /Loading/);
  } finally {
    f.cleanup();
  }
});
test("video changes clear enlarged media and ignore stale signing configuration responses", async () => {
  let deliver;
  const f = await signingFixture({
    extraFetch: (url) =>
      String(url).includes("videoId=9hE5-98ZeCg")
        ? new Promise((r) => {
            deliver = r;
          })
        : undefined,
  });
  try {
    await f.load();
    f.toggle();
    f.ready();
    const old = f.videos.at(-1);
    f.root.querySelector(".expand-sign").click();
    await f.load("https://youtu.be/9hE5-98ZeCg");
    assert.equal(old.paused, true);
    assert.equal(f.root.querySelector("dialog"), null);
    assert.equal(
      f.root.querySelector("video"),
      null,
      "old recording clears before configuration arrives",
    );
    await f.load();
    const current = f.videos.at(-1);
    assert.notEqual(current, old);
    deliver(
      Response.json({
        signLanguage: {
          url: "/wrong.webm",
          videoId: "9hE5-98ZeCg",
          reviewer: "Other",
          offsetSeconds: 0,
        },
      }),
    );
    await wait(0);
    assert.equal(f.root.querySelector("video"), current);
    assert.notEqual(current.src, "/wrong.webm");
  } finally {
    f.cleanup();
  }
});
test("learning preview stays available when interpreter configuration is missing or fails", async () => {
  let fail = false;
  const f = await signingFixture({
    extraFetch: (url) =>
      String(url).includes("/media")
        ? fail
          ? Promise.reject(Error("offline"))
          : Response.json({ signLanguage: null })
        : undefined,
  });
  try {
    f.toggle();
    assert.match(
      f.root.querySelector(".sign-status").textContent,
      /AI captions.*experimental avatar/,
    );
    assert.equal(f.videos.length, 0);
    fail = true;
    await f.load();
    assert.match(
      f.root.querySelector(".sign-status").textContent,
      /could not be checked/,
    );
    const retry = f.root.querySelector(".sign-action");
    assert.equal(retry.hidden, false);
    fail = false;
    retry.click();
    await wait(10);
    assert.match(
      f.root.querySelector(".sign-status").textContent,
      /AI captions.*experimental avatar/,
    );
    assert.equal(f.videos.length, 0);
  } finally {
    f.cleanup();
  }
});
test("unsupported signing media keeps a retry error instead of requesting autoplay permission", async () => {
  const f = await signingFixture({
    play: () => Promise.reject({ name: "NotSupportedError" }),
  });
  try {
    await f.load();
    f.toggle();
    f.state(1, 10);
    f.ready();
    await wait(0);
    const video = f.videos.at(-1);
    assert.equal(
      f.root.querySelector(".sign-action").textContent,
      "Retry signing",
    );
    video.oncanplay();
    video.onwaiting();
    f.state(1, 20);
    assert.match(
      f.root.querySelector(".sign-status").textContent,
      /could not be played/,
    );
    assert.equal(video.calls, 1);
  } finally {
    f.cleanup();
  }
});
test("source changes remove an enlarged panel synchronously before a queued native close event", async () => {
  const f = await signingFixture();
  try {
    await f.load();
    f.toggle();
    f.ready();
    f.root.querySelector(".expand-sign").click();
    const oldDialog = f.root.querySelector("dialog");
    oldDialog.close = () => {
      oldDialog.removeAttribute("open");
      setTimeout(
        () => oldDialog.dispatchEvent(new f.window.Event("close")),
        20,
      );
    };
    f.root.querySelector(".url-form input").value =
      "https://youtu.be/9hE5-98ZeCg";
    f.root
      .querySelector(".url-form")
      .dispatchEvent(new f.window.Event("submit", { cancelable: true }));
    assert.equal(f.root.querySelector("dialog"), null);
    assert.equal(f.root.querySelector("video"), null);
    await f.load();
    f.ready();
    f.root.querySelector(".expand-sign").click();
    const nextDialog = f.root.querySelector("dialog");
    await wait(30);
    assert.equal(
      f.root.querySelector("dialog"),
      nextDialog,
      "old close must not affect a new dialog",
    );
  } finally {
    f.cleanup();
  }
});
test("MVP captions and experimental avatar follow the transcript without a signing recording", async () => {
  const f = await signingFixture({
    extraFetch: (url) =>
      String(url).includes("/media")
        ? Response.json({
            defaultVideoUrl: "https://youtu.be/bJzb-RuUcMU",
            signLanguage: null,
          })
        : String(url).endsWith("/transcriptions")
          ? Response.json({
              title: "Test",
              language: "en",
              generated: true,
              videoUrl: "https://www.youtube.com/watch?v=bJzb-RuUcMU",
              cues: [
                { start: 0, end: 4, text: "Hello and welcome." },
                { start: 4, end: 8, text: "Compare local and cloud." },
                { start: 10, end: 14, text: "Look at this code." },
              ],
            })
          : undefined,
  });
  try {
    await f.load();
    f.toggle();
    const style = f.root.querySelector('[aria-label="Animation style"]');
    style.value = "gestures";
    style.onchange();
    assert.ok(f.root.querySelector(".gesture-viewport svg"));
    assert.match(
      f.root.querySelector(".gesture-note").textContent,
      /not EthSL translation/,
    );
    f.root.querySelector(".preview-generate").click();
    await wait(0);
    assert.equal(
      f.calls.some((c) => String(c.url).endsWith("/transcriptions")),
      false,
    );
    assert.match(
      f.root.querySelector(".caption-words").textContent,
      /checkbox/,
    );
    f.root.querySelector("input[type=checkbox]").checked = true;
    f.root.querySelector(".preview-generate").click();
    await wait(30);
    assert.equal(
      f.calls.filter((c) => String(c.url).endsWith("/transcriptions")).length,
      1,
    );
    assert.equal(
      f.root.querySelector(".caption-words").textContent,
      "Hello and welcome.",
    );
    assert.equal(
      f.root
        .querySelector(".gesture-viewport svg")
        .getAttribute("data-gesture"),
      "wave",
    );
    f.state(1, 5);
    assert.equal(
      f.root.querySelector(".caption-words").textContent,
      "Compare local and cloud.",
    );
    assert.equal(f.root.querySelector(".caption-time").textContent, "00:05");
    assert.equal(
      f.root
        .querySelector(".gesture-viewport svg")
        .getAttribute("data-gesture"),
      "compare",
    );
    f.state(2, 11);
    assert.equal(
      f.root.querySelector(".caption-words").textContent,
      "Look at this code.",
    );
    assert.equal(
      f.root
        .querySelector(".gesture-viewport svg")
        .getAttribute("data-gesture"),
      "point",
    );
    f.state(1, 9);
    assert.match(
      f.root.querySelector(".caption-words").textContent,
      /No speech/,
    );
    assert.equal(
      f.root
        .querySelector(".gesture-viewport svg")
        .getAttribute("data-gesture"),
      "rest",
    );
    const select = f.root.querySelector(".preview-mode select");
    select.value = "captions";
    select.onchange();
    assert.equal(f.root.querySelector(".gesture-viewport").hidden, true);
    assert.equal(f.root.querySelector(".live-caption").hidden, false);
    select.value = "avatar";
    select.onchange();
    assert.equal(f.root.querySelector(".live-caption").hidden, true);
    assert.equal(f.root.querySelector(".gesture-viewport").hidden, false);
    select.value = "both";
    select.onchange();
    assert.equal(f.root.querySelector(".live-caption").hidden, false);
    f.root.querySelector(".expand-sign").click();
    assert.ok(f.root.querySelector("dialog .caption-words"));
    f.root.querySelector("dialog button").click();
    assert.equal(f.root.querySelector("dialog"), null);
    await f.load("https://youtu.be/9hE5-98ZeCg");
    assert.match(
      f.root.querySelector(".caption-words").textContent,
      /Generate captions/,
    );
  } finally {
    f.cleanup();
  }
});
test("reviewed interpreter takes priority and captions-only mode pauses its media", async () => {
  const f = await signingFixture();
  try {
    await f.load();
    f.toggle();
    f.ready();
    f.state(1, 10);
    await wait(0);
    const video = f.videos.at(-1);
    assert.equal(f.root.querySelector(".gesture-viewport"), null);
    assert.match(
      f.root.querySelector(".sign-label").textContent,
      /REVIEWED ETHSL/,
    );
    const select = f.root.querySelector(".preview-mode select");
    select.value = "captions";
    select.onchange();
    assert.equal(video.paused, true);
    f.state(1, 20);
    assert.equal(video.paused, true);
    select.value = "both";
    select.onchange();
    await wait(0);
    assert.equal(video.paused, false);
    assert.equal(video.currentTime, 19);
  } finally {
    f.cleanup();
  }
});
test("caption generation failures stay visible in the panel and can be retried", async () => {
  const f = await signingFixture({
    extraFetch: (url) =>
      String(url).includes("/media")
        ? Response.json({ signLanguage: null })
        : String(url).endsWith("/transcriptions")
          ? Response.json({ error: "Gemini quota reached" }, { status: 502 })
          : undefined,
  });
  try {
    await f.load();
    f.toggle();
    f.root.querySelector("input[type=checkbox]").checked = true;
    f.root.querySelector(".preview-generate").click();
    await wait(25);
    assert.match(
      f.root.querySelector(".caption-words").textContent,
      /Gemini quota reached/,
    );
    assert.equal(f.root.querySelector(".preview-generate").disabled, false);
    assert.equal(f.root.querySelector(".preview-generate").hidden, false);
    assert.ok(f.root.querySelector(".gesture-viewport svg"));
  } finally {
    f.cleanup();
  }
});
test("avatar animation runs from source playback and stops on pause, captions-only mode and hiding", async () => {
  const f = await signingFixture({
    motion: true,
    extraFetch: (url) =>
      String(url).includes("/media")
        ? Response.json({ signLanguage: null })
        : String(url).endsWith("/transcriptions")
          ? Response.json({
              title: "Hello",
              language: "en",
              generated: true,
              videoUrl: "https://www.youtube.com/watch?v=bJzb-RuUcMU",
              cues: [{ start: 0, end: 20, text: "Hello and welcome" }],
            })
          : undefined,
  });
  try {
    await f.load();
    f.toggle();
    f.root.querySelector("input[type=checkbox]").checked = true;
    f.root.querySelector(".preview-generate").click();
    await wait(25);
    assert.equal(f.frames.size, 0);
    f.state(1, 2);
    assert.equal(f.frames.size, 1);
    const hand = f.root.querySelector('[data-hand="1"]');
    const before = hand.getAttribute("transform");
    await wait(12);
    const [id, draw] = f.frames.entries().next().value;
    f.frames.delete(id);
    draw();
    assert.notEqual(hand.getAttribute("transform"), before);
    assert.equal(f.frames.size, 1);
    f.state(2);
    assert.equal(f.frames.size, 0);
    f.state(1);
    f.root.querySelector(".preview-mode select").value = "captions";
    f.root.querySelector(".preview-mode select").onchange();
    assert.equal(f.frames.size, 0);
    f.root.querySelector(".preview-mode select").value = "both";
    f.root.querySelector(".preview-mode select").onchange();
    assert.equal(f.frames.size, 1);
    f.toggle();
    assert.equal(f.frames.size, 0);
    f.toggle();
    assert.equal(f.frames.size, 1);
    f.media.remove();
    assert.equal(f.frames.size, 0);
  } finally {
    f.cleanup();
  }
});
test("first prepared transcript selects whole-video context after an earlier player-state event", async () => {
  const f = setup({
    html: "<mela-course-media></mela-course-media>",
    answer: async () =>
      Response.json({
        answer: "Grounded video answer",
        citations: [],
        provider: "none",
        matched: true,
        actions: [],
      }),
  });
  try {
    const media = f.window.document.querySelector("mela-course-media");
    const video = {
      videoId: "9hE5-98ZeCg",
      url: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
      title: "Selected video",
      currentTime: 1,
      duration: 149,
      transcriptRevision: "prepared-1",
    };
    media.dispatchEvent(
      new f.window.CustomEvent("mela:video-state", {
        bubbles: true,
        detail: video,
      }),
    );
    media.dispatchEvent(
      new f.window.CustomEvent("mela:transcript-ready", {
        bubbles: true,
        detail: {
          video,
          cues: [{ start: 0, end: 5, text: "PREPARED_SOURCE_CONTEXT" }],
        },
      }),
    );
    assert.equal(f.root.querySelector(".context-scope").value, "wholeVideo");
    await question(f, "Explain this video");
    const sent = JSON.parse(
      f.calls.find((c) => String(c.url).endsWith("/ask")).init.body,
    );
    assert.equal(sent.scope, "wholeVideo");
    assert.ok(
      sent.context.sections.some((section) =>
        section.content.includes("PREPARED_SOURCE_CONTEXT"),
      ),
    );
  } finally {
    f.cleanup();
  }
});

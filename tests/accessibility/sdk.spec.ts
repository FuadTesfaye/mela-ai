import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const backend = process.env.E2E_BASE_URL || "http://localhost:3000";
const video = "https://www.youtube.com/watch?v=9hE5-98ZeCg";
const captions = {
  title: "Synthetic SDK timing fixture",
  language: "en",
  videoUrl: video,
  generated: false,
  source: "youtube-captions",
  cues: [
    { start: 0, end: 10, text: "Hello world" },
    { start: 10, end: 20, text: "Look at code" },
  ],
};
let host: Server;
test.beforeAll(async () => {
  host = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Independent LMS</title><style>body{margin:12px;font-family:Arial}#target{max-width:1100px}</style><h1>Independent host site</h1><div id="target"><p id="host-owned">Host-owned content</p></div><script src="${backend}/mela-sdk.js"></script><script>window.mounted=MelaAI.mount({container:'#target',api:'${backend}/api',assistant:false}).then(handle=>window.companion=handle);</script></html>`,
    );
  });
  await new Promise<void>((resolve, reject) => {
    host.once("error", reject);
    host.listen(4173, "127.0.0.1", resolve);
  });
});
test.afterAll(async () => {
  if (host)
    await new Promise<void>((resolve, reject) =>
      host.close((error) => (error ? reject(error) : resolve())),
    );
});
async function fixtures(page: Page) {
  await page.route("**/transcripts/9hE5-98ZeCg.json", (route) =>
    route.fulfill({
      json: captions,
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Synthetic player fixture, not real media playback</title>",
    }),
  );
  await page.addInitScript(() => {
    const state = {
      seconds: 0,
      anchor: Date.now(),
      playing: false,
      rate: 1,
      destroyed: false,
    };
    let events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
      onPlaybackRateChange?: () => void;
    };
    const win = window as unknown as { YT: unknown; sdkSource: typeof state };
    win.sdkSource = state;
    win.YT = {
      Player: class {
        constructor(
          _frame: HTMLIFrameElement,
          options: { events: typeof events },
        ) {
          events = options.events;
          queueMicrotask(() => events.onReady());
        }
        getCurrentTime() {
          return (
            state.seconds +
            (state.playing
              ? ((Date.now() - state.anchor) / 1000) * state.rate
              : 0)
          );
        }
        getDuration() {
          return 149;
        }
        getPlayerState() {
          return state.playing ? 1 : 2;
        }
        getPlaybackRate() {
          return state.rate;
        }
        setPlaybackRate(rate: number) {
          state.seconds = this.getCurrentTime();
          state.anchor = Date.now();
          state.rate = rate;
          events.onPlaybackRateChange?.();
        }
        playVideo() {
          state.anchor = Date.now();
          state.playing = true;
          events.onStateChange({ data: 1 });
        }
        pauseVideo() {
          state.seconds = this.getCurrentTime();
          state.playing = false;
          events.onStateChange({ data: 2 });
        }
        seekTo(seconds: number) {
          state.seconds = seconds;
          state.anchor = Date.now();
          events.onStateChange({ data: state.playing ? 1 : 2 });
        }
        destroy() {
          state.destroyed = true;
          state.playing = false;
        }
      },
    };
  });
}
test("SDK mounts on another origin, loads backend captions and follows play, pause, speed and seeking", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("http://localhost:4173");
  const media = page.locator("mela-course-media");
  await media
    .getByRole("button", { name: "Show learning panel", exact: true })
    .click();
  await expect(media.locator(".caption-heading strong")).toHaveText(
    "COURSE CAPTIONS",
  );
  await expect(media.locator(".caption-words")).toHaveText("Hello world");
  await media
    .getByRole("button", { name: "Load YouTube video", exact: true })
    .click();
  const play = media.getByRole("button", { name: "Play lesson", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(media.locator(".motion-state")).toContainText("Following video");
  const hand = media.locator('[data-hand="1"]');
  const before = await hand.getAttribute("transform");
  await expect.poll(() => hand.getAttribute("transform")).not.toBe(before);
  await media
    .getByRole("button", { name: "Pause lesson", exact: true })
    .click();
  const paused = await hand.getAttribute("transform");
  await page.waitForTimeout(150);
  await expect(hand).toHaveAttribute("transform", paused!);
  await media
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("2");
  await media.getByRole("button", { name: "Play lesson", exact: true }).click();
  await expect(media.locator(".motion-state")).toContainText("2×");
  await media.locator('.cue[data-start="10"]').click();
  await expect(media.locator(".caption-words")).toHaveText("Look at code");
  await expect(media.locator(".spelling-label")).not.toBeEmpty();
  await page.evaluate(() => {
    (
      window as unknown as { companion: { destroy: () => void } }
    ).companion.destroy();
  });
  await expect(media).toHaveCount(0);
  await expect(page.locator("#host-owned")).toHaveText("Host-owned content");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { sdkSource: { destroyed: boolean } }).sdkSource
          .destroyed,
    ),
  ).toBe(true);
});
test("reduced motion has an explicit animation override and no overflow at 320px", async ({
  page,
}) => {
  await fixtures(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://localhost:4173");
  const media = page.locator("mela-course-media");
  await media
    .getByRole("button", { name: "Show learning panel", exact: true })
    .click();
  await expect(media.locator(".caption-words")).toHaveText("Hello world");
  await media
    .getByRole("button", { name: "Load YouTube video", exact: true })
    .click();
  await media.getByRole("button", { name: "Play lesson", exact: true }).click();
  await expect(media.locator(".motion-state")).toContainText(
    "Animation paused",
  );
  await media
    .getByRole("button", { name: "Enable animation", exact: true })
    .click();
  await expect(media.locator(".motion-state")).toContainText("Following video");
  const hand = media.locator('[data-hand="1"]');
  const before = await hand.getAttribute("transform");
  await expect.poll(() => hand.getAttribute("transform")).not.toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.addScriptTag({
    content: await readFile(
      resolve("node_modules/axe-core/axe.min.js"),
      "utf8",
    ),
  });
  const violations = await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (
            element: Element | null,
          ) => Promise<{ violations: { id: string; impact: string }[] }>;
        };
      }
    ).axe.run(document.querySelector("mela-course-media"));
    return result.violations.filter((x) =>
      ["serious", "critical"].includes(x.impact),
    );
  });
  expect(violations).toEqual([]);
});
test("iframe wrapper renders the React adapter without requiring host React or styles", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("http://localhost:4173");
  await page.evaluate((url) => {
    document.querySelector("#target")!.replaceChildren();
    const frame = document.createElement("iframe");
    frame.src = url;
    frame.title = "MELA wrapper";
    frame.style.cssText = "width:100%;height:900px;border:0";
    document.querySelector("#target")!.append(frame);
  }, backend + "/embed");
  const media = page
    .frameLocator('iframe[title="MELA wrapper"]')
    .locator("mela-course-media");
  await media
    .getByRole("button", { name: "Show learning panel", exact: true })
    .click();
  await expect(media.locator(".caption-words")).toHaveText("Hello world");
  await media
    .getByRole("button", { name: "Load YouTube video", exact: true })
    .click();
  await media.getByRole("button", { name: "Play lesson", exact: true }).click();
  await expect(media.locator(".motion-state")).toContainText("Following video");
});
test("multiple SDK instances preserve host content and release shared context only after the last destroy", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("http://localhost:4173");
  await page.waitForFunction(
    () => !!(window as unknown as { companion?: unknown }).companion,
  );
  const state = await page.evaluate(async (api) => {
    const win = window as unknown as {
      companion: { destroy: () => void };
      MelaAI: {
        mount: (options: {
          container: string;
          api: string;
          assistant: boolean;
          contextRoot: string;
        }) => Promise<{
          destroy: () => void;
          media: HTMLElement;
          assistant?: HTMLElement;
        }>;
      };
    };
    win.companion.destroy();
    const options = {
      container: "#target",
      api,
      assistant: true,
      contextRoot: "#host-owned",
    };
    const first = await win.MelaAI.mount(options);
    const second = await win.MelaAI.mount(options);
    first.media.dispatchEvent(
      new CustomEvent("mela:video-state", {
        bubbles: true,
        composed: true,
        detail: {
          videoId: "9hE5-98ZeCg",
          url: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
          title: "First",
          currentTime: 12,
          duration: 149,
        },
      }),
    );
    second.media.dispatchEvent(
      new CustomEvent("mela:video-state", {
        bubbles: true,
        composed: true,
        detail: {
          videoId: "bJzb-RuUcMU",
          url: "https://www.youtube.com/watch?v=bJzb-RuUcMU",
          title: "Second",
          currentTime: 34,
          duration: 149,
        },
      }),
    );
    const firstTime =
      first.assistant?.shadowRoot?.querySelector(".video-time")?.textContent;
    const secondTime =
      second.assistant?.shadowRoot?.querySelector(".video-time")?.textContent;
    first.destroy();
    const shared = document
      .querySelector("#host-owned")!
      .hasAttribute("data-mela-context");
    second.destroy();
    return {
      shared,
      firstTime,
      secondTime,
      released: !document
        .querySelector("#host-owned")!
        .hasAttribute("data-mela-context"),
      text: document.querySelector("#host-owned")!.textContent,
      remaining: document.querySelectorAll("mela-course-media").length,
    };
  }, backend + "/api");
  expect(state).toEqual({
    shared: true,
    firstTime: "Video · 0:12",
    secondTime: "Video · 0:34",
    released: true,
    text: "Host-owned content",
    remaining: 0,
  });
});

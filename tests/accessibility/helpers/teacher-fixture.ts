import type { Page } from "@playwright/test";
const spans = [
  [0, 10.6, "Live interaction"],
  [10.6, 28.87, "Shared screen"],
  [28.87, 46.9, "Selected text"],
  [46.9, 50.87, "Available tools"],
  [50.87, 71.33, "Text, images and audio"],
  [71.33, 103.13, "Interruptions"],
  [103.13, 133.13, "Conversation memory"],
  [133.13, 149, "Review"],
] as const;
export const teacherCues = spans.map(([start, end, text]) => ({
  start,
  end,
  text,
}));
export async function teacherFixture(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/transcripts/9hE5-98ZeCg.json", (route) =>
    route.fulfill({
      json: {
        title: "Synthetic timing fixture, not an actual transcript",
        language: "en",
        videoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
        generated: false,
        cues: teacherCues,
      },
      headers: { "Access-Control-Allow-Origin": "*" },
    }),
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Synthetic player for timing tests</title>",
    }),
  );
  await page.addInitScript(() => {
    const state = { seconds: 0, anchor: Date.now(), playing: false, rate: 1 };
    let events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
      onPlaybackRateChange?: () => void;
    };
    const win = window as unknown as { YT: unknown; teacherPlayer: unknown };
    win.YT = {
      Player: class {
        constructor(
          _frame: HTMLIFrameElement,
          options: { events: typeof events },
        ) {
          events = options.events;
          win.teacherPlayer = this;
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
          state.playing = false;
        }
      },
    };
  });
}
export const media = (page: Page) => page.locator("mela-course-media");
export async function loadLesson(page: Page) {
  await page.goto("/demo/sdk.html");
  await media(page)
    .getByRole("button", { name: "Load YouTube video", exact: true })
    .click();
}
export async function openTeacher(page: Page) {
  await media(page)
    .getByRole("button", { name: "Show learning panel", exact: true })
    .click();
}
export async function seek(page: Page, seconds: number) {
  await page.evaluate(
    (time) =>
      (
        window as unknown as {
          teacherPlayer: { seekTo: (seconds: number) => void };
        }
      ).teacherPlayer.seekTo(time),
    seconds,
  );
}
export async function sourceTime(page: Page) {
  return page.evaluate(() =>
    (
      window as unknown as { teacherPlayer: { getCurrentTime: () => number } }
    ).teacherPlayer.getCurrentTime(),
  );
}

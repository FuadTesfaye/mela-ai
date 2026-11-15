import { test, expect } from "@playwright/test";
import {
  media,
  teacherFixture,
  loadLesson,
  openTeacher,
  seek,
  sourceTime,
} from "./helpers/teacher-fixture";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
test.beforeEach(async ({ page }) => {
  await teacherFixture(page);
});
test("3D is lazy and both hands render in step with play, pause, seek and speed", async ({
  page,
}) => {
  const downloads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("teacher-3d.js")) downloads.push(request.url());
  });
  await loadLesson(page);
  expect(downloads).toHaveLength(0);
  await openTeacher(page);
  const canvas = media(page).locator(".teacher-canvas canvas");
  await expect(canvas).toBeVisible();
  expect(downloads).toHaveLength(1);
  await seek(page, 58);
  await expect(media(page).locator(".concept-card h4")).toHaveText(
    "More than one kind of input",
  );
  await media(page)
    .getByRole("button", { name: "Play lesson", exact: true })
    .click();
  const before = await canvas.getAttribute("data-left-hand");
  await expect
    .poll(() => canvas.getAttribute("data-left-hand"))
    .not.toBe(before);
  await expect(canvas).toHaveAttribute("data-gesture", "compare");
  await media(page)
    .getByRole("button", { name: "Pause lesson", exact: true })
    .click();
  await page.waitForTimeout(100);
  const held = await canvas.getAttribute("data-phase");
  await page.waitForTimeout(150);
  await expect(canvas).toHaveAttribute("data-phase", held!);
  const front = await canvas.screenshot();
  await media(page)
    .getByRole("button", { name: "Hands focus", exact: true })
    .click();
  await page.waitForTimeout(80);
  expect((await canvas.screenshot()).equals(front)).toBe(false);
  await media(page)
    .getByRole("button", { name: "Reset view", exact: true })
    .click();
  await media(page)
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("2");
  await media(page)
    .getByRole("button", { name: "Play lesson", exact: true })
    .click();
  await expect(media(page).locator(".motion-state")).toContainText("2×");
  await expect
    .poll(async () =>
      Math.abs(
        Number(await canvas.getAttribute("data-seconds")) -
          (await sourceTime(page)),
      ),
    )
    .toBeLessThan(0.5);
  await seek(page, 105);
  await expect(canvas).toHaveAttribute("data-gesture", "connect");
  await expect(media(page).locator(".concept-card h4")).toHaveText(
    "Earlier context helps a later answer",
  );
});
test("Explain pauses and enlarges; demonstration replay changes only the teacher, and resume closes it", async ({
  page,
}) => {
  await loadLesson(page);
  await openTeacher(page);
  await expect(media(page).locator(".teacher-canvas canvas")).toBeVisible();
  await seek(page, 105);
  await media(page)
    .getByRole("button", { name: "Play lesson", exact: true })
    .click();
  await media(page)
    .getByRole("button", { name: "Explain this moment", exact: true })
    .click();
  const dialog = media(page).getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".concept-explanation")).toContainText(
    /earlier/i,
  );
  const at = await sourceTime(page);
  await dialog
    .getByRole("button", { name: "Replay demonstration", exact: true })
    .click();
  const canvas = dialog.locator("canvas");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-phase")))
    .toBeGreaterThan(0.05);
  await page.waitForTimeout(150);
  expect(await sourceTime(page)).toBe(at);
  await dialog
    .getByRole("combobox", { name: "Demonstration speed", exact: true })
    .selectOption("0.5");
  await expect(dialog.locator(".demonstration-controls")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Resume lesson", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    media(page).getByRole("button", { name: "Pause lesson", exact: true }),
  ).toBeEnabled();
  await expect.poll(() => sourceTime(page)).toBeGreaterThan(at);
});
test("seeking invalidates a captured explanation and hiding cancels demonstration playback", async ({
  page,
}) => {
  await loadLesson(page);
  await openTeacher(page);
  await seek(page, 105);
  await media(page)
    .getByRole("button", { name: "Explain this moment", exact: true })
    .click();
  await expect(media(page).locator(".demonstration-controls")).toBeVisible();
  await seek(page, 58);
  await expect(media(page).locator(".demonstration-controls")).toBeHidden();
  await expect(media(page).locator(".concept-card h4")).toHaveText(
    "More than one kind of input",
  );
  await media(page)
    .getByRole("dialog")
    .getByRole("button", { name: "Close enlarged panel", exact: true })
    .click();
  await media(page)
    .getByRole("button", { name: "Hide learning panel", exact: true })
    .click();
  await expect(media(page).locator(".sign-box")).toBeHidden();
});
test("2D is usable without WebGL and the renderer attribute prevents a 3D download", async ({
  page,
}) => {
  const downloads: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("teacher-3d.js")) downloads.push(r.url());
  });
  await loadLesson(page);
  await media(page).evaluate((el) => el.setAttribute("renderer", "2d"));
  await openTeacher(page);
  await seek(page, 58);
  await expect(media(page).locator(".teacher-renderer-status")).toContainText(
    "2D illustration selected",
  );
  await expect(media(page).locator(".gesture-viewport svg")).toBeVisible();
  await expect(media(page).locator(".concept-card h4")).toHaveText(
    "More than one kind of input",
  );
  expect(downloads).toHaveLength(0);
});
test("WebGL context loss falls back without losing captions and supports explicit retry", async ({
  page,
}) => {
  await loadLesson(page);
  await openTeacher(page);
  const canvas = media(page).locator(".teacher-canvas canvas");
  await expect(canvas).toBeVisible();
  await seek(page, 58);
  await canvas.evaluate((node) =>
    (node as HTMLCanvasElement)
      .getContext("webgl2")!
      .getExtension("WEBGL_lose_context")!
      .loseContext(),
  );
  await expect(canvas).toHaveCount(0);
  await expect(media(page).locator(".teacher-renderer-status")).toContainText(
    "interrupted",
  );
  await expect(media(page).locator(".gesture-viewport svg")).toBeVisible();
  await expect(media(page).locator(".caption-words")).toHaveText(
    "Text, images and audio",
  );
  await media(page)
    .getByRole("combobox", { name: "Teacher graphics", exact: true })
    .selectOption("3d");
  await expect(canvas).toBeVisible();
});
test("failed and late runtime downloads never create a hidden or stale canvas", async ({
  page,
}) => {
  await page.route("**/avatar/teacher-3d.js", (route) => route.abort());
  await loadLesson(page);
  await openTeacher(page);
  await expect(media(page).locator(".teacher-renderer-status")).toContainText(
    "download failed",
  );
  await expect(media(page).locator(".gesture-viewport svg")).toBeVisible();
  await expect(media(page).locator("canvas")).toHaveCount(0);
});
test("reduced motion keeps a static teacher and an explicit override; mobile controls remain accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 900 });
  await loadLesson(page);
  await openTeacher(page);
  const canvas = media(page).locator(".teacher-canvas canvas");
  await expect(canvas).toBeVisible();
  await seek(page, 58);
  await media(page)
    .getByRole("button", { name: "Play lesson", exact: true })
    .click();
  await page.waitForTimeout(100);
  const fixed = await canvas.getAttribute("data-phase");
  await page.waitForTimeout(150);
  await expect(canvas).toHaveAttribute("data-phase", fixed!);
  await media(page)
    .getByRole("button", { name: "Enable animation", exact: true })
    .click();
  await expect.poll(() => canvas.getAttribute("data-phase")).not.toBe(fixed);
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
            node: Element | null,
          ) => Promise<{ violations: { id: string; impact: string }[] }>;
        };
      }
    ).axe.run(document.querySelector("mela-course-media"));
    return result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    );
  });
  expect(violations).toEqual([]);
});
test("all poses keep both hands in frame and repeated disposal frees GPU resources", async ({
  page,
}) => {
  await page.goto("/demo/blank.html");
  await page.addScriptTag({ url: "/avatar/teacher-3d.js" });
  const results = await page.evaluate(() => {
    const factory = (
      window as unknown as {
        MelaTeacher3D: {
          mount: (
            host: HTMLElement,
            options: { onFailure: () => void },
          ) => {
            update: (frame: unknown) => void;
            dispose: () => void;
            stats: () => {
              handsInFrame: boolean;
              triangles: number;
              geometries: number;
              disposed: boolean;
            };
          };
        };
      }
    ).MelaTeacher3D;
    const host = document.createElement("div");
    host.style.cssText = "width:420px;height:420px";
    document.body.append(host);
    let inFrame = true,
      maxTriangles = 0,
      released = true;
    for (let cycle = 0; cycle < 3; cycle++) {
      const renderer = factory.mount(host, { onFailure: () => {} });
      for (const camera of ["front", "hands"])
        for (const gesture of [
          "welcome",
          "point",
          "compare",
          "connect",
          "count",
          "emphasize",
          "rest",
        ]) {
          renderer.update({
            seconds: 2,
            phase: 0.5,
            gesture,
            playing: false,
            visible: true,
            motion: true,
            camera,
          });
          const stats = renderer.stats();
          inFrame = inFrame && stats.handsInFrame;
          maxTriangles = Math.max(maxTriangles, stats.triangles);
        }
      renderer.dispose();
      released =
        released &&
        renderer.stats().disposed &&
        renderer.stats().geometries === 0;
    }
    const remaining = host.querySelectorAll("canvas").length;
    host.remove();
    return { inFrame, maxTriangles, released, remaining };
  });
  expect(results.inFrame).toBe(true);
  expect(results.maxTriangles).toBeLessThan(30000);
  expect(results.released).toBe(true);
  expect(results.remaining).toBe(0);
});
test("a late 3D download is not mounted into a hidden panel and is reused when reopened", async ({
  page,
}) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/avatar/teacher-3d.js", async (route) => {
    requests++;
    await held;
    await route.fulfill({
      contentType: "application/javascript",
      body: await readFile(resolve("public/avatar/teacher-3d.js")),
    });
  });
  await loadLesson(page);
  await openTeacher(page);
  await expect(media(page).locator(".teacher-renderer-status")).toContainText(
    "Loading",
  );
  await media(page)
    .getByRole("button", { name: "Hide learning panel", exact: true })
    .click();
  release();
  await page.waitForTimeout(150);
  await expect(media(page).locator("canvas")).toHaveCount(0);
  await openTeacher(page);
  await expect(media(page).locator(".teacher-canvas canvas")).toBeVisible();
  expect(requests).toBe(1);
});

test("transcript cues drive both hands, silence rests, and seeking restores the same pose", async ({
  page,
}) => {
  await page.route("**/transcripts/9hE5-98ZeCg.json", (route) =>
    route.fulfill({
      json: {
        title: "Synthetic caption gesture fixture",
        language: "en",
        videoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
        generated: false,
        cues: [
          { start: 0, end: 3, text: "Look at the screen" },
          { start: 4, end: 7, text: "Compare different inputs" },
          { start: 8, end: 11, text: "Connect them together" },
        ],
      },
    }),
  );
  await loadLesson(page);
  await openTeacher(page);
  const canvas = media(page).locator(".teacher-canvas canvas");
  await expect(canvas).toBeVisible();
  await seek(page, 0.8);
  await expect(canvas).toHaveAttribute("data-gesture", "point");
  const initial = {
    left: await canvas.getAttribute("data-left-hand"),
    right: await canvas.getAttribute("data-right-hand"),
  };
  await seek(page, 1.8);
  const delta = (a: string | null, b: string | null) =>
    Math.hypot(
      ...a!.split(",").map((v, i) => Number(v) - Number(b!.split(",")[i])),
    );
  await expect
    .poll(async () =>
      delta(await canvas.getAttribute("data-left-hand"), initial.left),
    )
    .toBeGreaterThan(0.025);
  await expect
    .poll(async () =>
      delta(await canvas.getAttribute("data-right-hand"), initial.right),
    )
    .toBeGreaterThan(0.025);
  await seek(page, 0.8);
  await expect(canvas).toHaveAttribute("data-left-hand", initial.left!);
  await expect(canvas).toHaveAttribute("data-right-hand", initial.right!);
  await media(page)
    .getByRole("button", { name: "Play lesson", exact: true })
    .click();
  for (const hand of ["left", "right"] as const)
    await expect
      .poll(async () =>
        delta(await canvas.getAttribute(`data-${hand}-hand`), initial[hand]),
      )
      .toBeGreaterThan(0.025);
  await media(page)
    .getByRole("button", { name: "Pause lesson", exact: true })
    .click();
  await page.waitForTimeout(100);
  const heldLeft = await canvas.getAttribute("data-left-hand"),
    heldRight = await canvas.getAttribute("data-right-hand");
  await page.waitForTimeout(150);
  await expect(canvas).toHaveAttribute("data-left-hand", heldLeft!);
  await expect(canvas).toHaveAttribute("data-right-hand", heldRight!);
  await seek(page, 3.5);
  await expect(canvas).toHaveAttribute("data-gesture", "rest");
  await expect(media(page).locator(".caption-words")).toHaveText(
    "No speech at this moment.",
  );
  await seek(page, 5);
  await expect(canvas).toHaveAttribute("data-gesture", "compare");
  await seek(page, 9);
  await expect(canvas).toHaveAttribute("data-gesture", "connect");
});

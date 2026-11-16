import { test, expect, type Page } from "@playwright/test";
import {
  teacherFixture,
  teacherCues,
  loadLesson,
  openTeacher,
  seek,
  sourceTime,
  media,
} from "./helpers/teacher-fixture";
import { transcriptRevision } from "../../lib/media/video-context";
import { sourceRevision } from "../../lib/localization/service";
const video = "https://www.youtube.com/watch?v=9hE5-98ZeCg";
async function bilingualVideo(page: Page) {
  await teacherFixture(page);
  await page.route("**/transcripts/9hE5-98ZeCg.am.json", (route) =>
    route.fulfill({
      json: {
        version: 1,
        status: "ai-draft",
        revision: transcriptRevision(video, teacherCues),
        entries: teacherCues.map((cue, i) => ({
          sourceText: cue.text,
          targetText: "የሙከራ ትርጉም " + i,
        })),
      },
    }),
  );
}
test("prepared lesson reader translates all 18 slides without sending content to AI", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/translations")) external.push(r.url());
  });
  await page.goto("/savanna/pages/offline-first-localized-ai.html");
  const chat = page.locator("db-assistant");
  if (!(await chat.locator(".panel").isVisible()))
    await chat.locator(".launcher").click();
  await chat.getByText("Learning options", { exact: true }).click();
  await chat
    .getByRole("button", { name: "Read lesson in Amharic", exact: true })
    .click();
  const reader = chat.locator("dialog.mela-reader");
  await expect(reader).toBeVisible();
  await expect(reader.locator("section")).toHaveCount(18);
  await expect(reader).toContainText("ከመስመር");
  await expect(chat).toHaveAttribute("lang", "am");
  expect(external).toHaveLength(0);
  await reader
    .locator("section")
    .nth(6)
    .getByText("የእንግሊዝኛ ምንጩን አሳይ", { exact: true })
    .click();
  await expect(
    reader.locator("section").nth(6).locator("details"),
  ).toContainText("4-bit");
  await expect(page.locator("#offline-ai-slide-07")).toContainText(
    "Quantization",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reader.getByRole("button", { name: "ዝጋ", exact: true }).click();
  await chat.getByRole("textbox").fill("ኳንታይዜሽን ምንድን ነው?");
  await chat.getByRole("textbox").press("Enter");
  await expect(chat.locator(".message").last()).toContainText("4-bit");
  await expect(chat.locator(".message").last()).toHaveAttribute("lang", "am");
  await expect(chat.locator(".sources a").last()).toHaveAttribute(
    "href",
    /offline-first-localized-ai.html#/,
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.fonts].some(
          (f) => f.family === "MelaEthiopic" && f.status === "loaded",
        ),
      ),
    )
    .toBe(true);
});
test("a shared language change preserves draft, conversation, video clock and source-driven gestures", async ({
  page,
}) => {
  await bilingualVideo(page);
  await loadLesson(page);
  await openTeacher(page);
  await seek(page, 58);
  const chat = page.locator("db-assistant");
  if (!(await chat.locator(".panel").isVisible()))
    await chat.locator(".launcher").click();
  await chat.getByRole("textbox").fill("Keep this unsent question");
  await media(page)
    .getByRole("button", { name: "Play lesson", exact: true })
    .click();
  const at = await sourceTime(page);
  await media(page).locator(".course-language").selectOption("am");
  await expect(chat).toHaveAttribute("lang", "am");
  await expect(chat.getByRole("textbox")).toHaveValue(
    "Keep this unsent question",
  );
  await expect(media(page).locator(".caption-words")).toHaveText("የሙከራ ትርጉም 4");
  await expect(media(page).locator(".caption-words")).toHaveAttribute(
    "lang",
    "am",
  );
  await expect(media(page).locator(".teacher-canvas canvas")).toHaveAttribute(
    "data-gesture",
    "compare",
  );
  expect(await sourceTime(page)).toBeGreaterThan(at);
  await media(page).locator(".course-language").selectOption("en");
  await expect(chat).toHaveAttribute("lang", "en");
  await expect(media(page).locator(".caption-words")).toHaveText(
    "Text, images and audio",
  );
  await expect(chat.getByRole("textbox")).toHaveValue(
    "Keep this unsent question",
  );
});
async function readerFixture(page: Page) {
  await page.goto("/demo/sdk.html");
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-mela-sdk-root]")!;
    root.dataset.courseId = "new-course";
    root.dataset.lessonTitle = "Custom lesson";
    const section = document.createElement("section");
    section.dataset.melaSection = "";
    section.id = "custom";
    section.innerHTML =
      "<h2>Sensor lesson</h2><div data-mela-content><p>A sensor measures temperature.</p><pre>print(42)</pre></div>";
    root.prepend(section);
  });
  const chat = page.locator("db-assistant");
  if (!(await chat.locator(".panel").isVisible()))
    await chat.locator(".launcher").click();
  await chat.getByText("Learning options", { exact: true }).click();
  await chat
    .getByRole("button", { name: "Read lesson in Amharic", exact: true })
    .click();
  return chat;
}
test("on-demand translation waits for consent, retains code, and saves validated results", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/v1/translations", async (route) => {
    calls++;
    const data = route.request().postDataJSON();
    expect(data.cloudConsent).toBe(true);
    expect(data.items.some((i: { kind: string }) => i.kind === "code")).toBe(
      false,
    );
    await route.fulfill({
      json: {
        version: 1,
        sourceLanguage: "en",
        targetLanguage: "am",
        sourceRevision: sourceRevision(data.items),
        provenance: "ai-draft",
        items: data.items.map((i: { id: string }) => ({
          id: i.id,
          text: "የሙከራ ትርጉም",
        })),
      },
    });
  });
  const chat = await readerFixture(page),
    reader = chat.locator(".mela-reader");
  await expect(reader).toBeVisible();
  const action = reader.getByRole("button", {
    name: "የጎደለውን ትርጉም አዘጋጅ",
    exact: true,
  });
  await expect(action).toBeDisabled();
  expect(calls).toBe(0);
  await reader.getByRole("checkbox").check();
  await action.click();
  await expect(reader).toContainText("ትርጉሙ ተዘጋጅቷል");
  await expect(reader.locator("pre")).toContainText("print(42)");
  expect(calls).toBe(1);
  await reader.getByRole("button", { name: "ዝጋ", exact: true }).click();
  await chat
    .locator(".options")
    .getByRole("button", { name: "ትምህርቱን በአማርኛ ያንብቡ", exact: true })
    .click();
  await expect(reader).toContainText("የሙከራ ትርጉም");
  await expect(reader.getByRole("checkbox")).toHaveCount(0);
  expect(calls).toBe(1);
});
test("provider errors keep English source visible and allow a localized retry", async ({
  page,
}) => {
  await page.route("**/api/v1/translations", (route) =>
    route.fulfill({ status: 429, json: { error: "quota" } }),
  );
  const chat = await readerFixture(page),
    reader = chat.locator(".mela-reader");
  await reader.getByRole("checkbox").check();
  await reader
    .getByRole("button", { name: "የጎደለውን ትርጉም አዘጋጅ", exact: true })
    .click();
  await expect(reader.locator(".notice")).toContainText("ተጨናንቋል");
  await expect(reader).toContainText("A sensor measures temperature.");
  await expect(
    reader.getByRole("button", { name: "የጎደለውን ትርጉም አዘጋጅ", exact: true }),
  ).toBeEnabled();
});
test("late course translation cannot replace a different lesson", async ({
  page,
}) => {
  let finish: (() => void) | undefined;
  await page.route("**/api/v1/translations", async (route) => {
    const data = route.request().postDataJSON();
    await new Promise<void>((done) => (finish = done));
    await route.fulfill({
      json: {
        version: 1,
        sourceLanguage: "en",
        targetLanguage: "am",
        sourceRevision: sourceRevision(data.items),
        provenance: "ai-draft",
        items: data.items.map((i: { id: string }) => ({
          id: i.id,
          text: "የድሮ ትርጉም",
        })),
      },
    });
  });
  const chat = await readerFixture(page),
    reader = chat.locator(".mela-reader");
  await reader.getByRole("checkbox").check();
  await reader
    .getByRole("button", { name: "የጎደለውን ትርጉም አዘጋጅ", exact: true })
    .click();
  await expect.poll(() => !!finish).toBe(true);
  await page.evaluate(() => {
    document.querySelector(
      "[data-mela-sdk-root] #custom [data-mela-content]",
    )!.textContent = "A changed lesson about plants.";
  });
  finish!();
  await expect(reader).not.toContainText("የድሮ ትርጉም");
  await expect(reader.locator(".notice")).toContainText(/ተቀይሯል|እንግሊዝኛ/);
});
test("prepared Amharic reader and answers work offline after an online visit", async ({
  page,
  context,
}) => {
  await page.goto("/savanna/pages/offline-first-localized-ai.html");
  const chat = page.locator("db-assistant");
  if (!(await chat.locator(".panel").isVisible()))
    await chat.locator(".launcher").click();
  await chat
    .getByRole("combobox", { name: "Language / ቋንቋ" })
    .selectOption("am");
  await expect(
    chat.getByRole("button", { name: "ጥያቄ ይላኩ", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1000);
  await context.setOffline(true);
  await page.reload();
  if (!(await chat.locator(".panel").isVisible()))
    await chat.locator(".launcher").click();
  await expect(chat).toHaveAttribute("lang", "am");
  await chat.getByRole("textbox").fill("ኳንታይዜሽን");
  await chat.getByRole("textbox").press("Enter");
  await expect(chat.locator(".message").last()).toContainText("4-bit");
  await expect(chat.locator(".message").last()).toHaveAttribute("lang", "am");
});
test("SDK setLanguage isolates instances and an Amharic iframe boots without host translation access", async ({
  page,
}) => {
  await bilingualVideo(page);
  await page.goto("/demo/sdk.html");
  const result = await page.evaluate(async () => {
    const api = (window as any).MelaAI;
    const a = document.createElement("div"),
      b = document.createElement("div");
    document.body.append(a, b);
    const first = await api.mount({
        container: a,
        api: "/api",
        language: "en",
      }),
      second = await api.mount({ container: b, api: "/api", language: "en" });
    first.setLanguage("am");
    const result = {
      first: first.media.getAttribute("lang"),
      firstChat: first.assistant.getAttribute("lang"),
      second: second.media.getAttribute("lang"),
    };
    first.destroy();
    second.destroy();
    a.remove();
    b.remove();
    return result;
  });
  expect(result).toEqual({ first: "am", firstChat: "am", second: "en" });
  await page.goto("/embed?lang=am&renderer=2d");
  await expect(page.locator("mela-course-media")).toHaveAttribute("lang", "am");
  await expect(page.locator("db-assistant")).toHaveAttribute("lang", "am");
});
test("translated mobile captions preserve timestamps and reject mismatched timing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await bilingualVideo(page);
  await loadLesson(page);
  await openTeacher(page);
  await seek(page, 58);
  await media(page).locator(".course-language").selectOption("am");
  await expect(media(page).locator(".caption-words")).toHaveText("የሙከራ ትርጉም 4");
  await page.evaluate(() => {
    const el = document.querySelector("mela-course-media") as any;
    const source = el.getTranscript();
    el.setTranslatedCues({
      revision: el.snapshot().transcriptRevision,
      cues: source.cues.map((c: any) => ({
        ...c,
        start: c.start + 1,
        text: "WRONG",
      })),
    });
  });
  await expect(media(page).locator(".caption-words")).toHaveText("የሙከራ ትርጉም 4");
  const starts = await media(page)
    .locator(".cue")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number((node as HTMLElement).dataset.start)),
    );
  expect(starts).toEqual(teacherCues.map((c) => c.start));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

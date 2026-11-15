import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
// Synthetic configuration exercises panel behavior only, never EthSL quality.
for (const width of [320, 1280]) {
  test(`signing panel layout, reduced motion and dialog keyboard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("http://mela.test/**", async (route) => {
      if (new URL(route.request().url()).pathname.endsWith("/media"))
        return route.fulfill({
          json: {
            defaultVideoUrl: "https://youtu.be/bJzb-RuUcMU",
            signLanguage: {
              url: "http://mela.test/synthetic.webm",
              videoId: "bJzb-RuUcMU",
              reviewer: "Synthetic test fixture, not sign language",
              offsetSeconds: 0,
            },
          },
        });
      if (route.request().url().endsWith("synthetic.webm"))
        return route.fulfill({
          status: 404,
          body: "Test fixture intentionally has no linguistic content",
        });
      return route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="en"><title>Signing controls test</title><style>body{margin:8px}</style><mela-course-media></mela-course-media></html>',
      });
    });
    await page.route("https://www.youtube-nocookie.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Synthetic course player</title>",
      }),
    );
    await page.goto("http://mela.test/");
    await page.evaluate(() => {
      (window as unknown as { YT: unknown }).YT = {
        Player: class {
          getCurrentTime() {
            return 0;
          }
          getDuration() {
            return 120;
          }
          getPlayerState() {
            return 2;
          }
          getPlaybackRate() {
            return 1;
          }
          destroy() {}
        },
      };
    });
    await page.addScriptTag({
      content: await readFile("public/course-media.js", "utf8"),
    });
    const media = page.locator("mela-course-media");
    const toggle = media.getByRole("button", {
      name: "Show signing panel",
      exact: true,
    });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await media
      .getByRole("button", { name: "Load YouTube video", exact: true })
      .click();
    await toggle.click();
    await expect(media.locator(".expand-sign")).toBeVisible();
    const panel = media.locator(".sign-box");
    expect(
      await panel.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const playerBounds = await media.locator(".stage").boundingBox();
    const signBounds = await panel.boundingBox();
    expect(playerBounds).not.toBeNull();
    expect(signBounds).not.toBeNull();
    if (width === 320)
      expect(signBounds!.y).toBeGreaterThanOrEqual(
        playerBounds!.y + playerBounds!.height,
      );
    else
      expect(signBounds!.x).toBeGreaterThanOrEqual(
        playerBounds!.x + playerBounds!.width,
      );
    await media
      .locator("video")
      .evaluate((el) => el.setAttribute("data-same-video", "yes"));
    const enlarge = media.getByRole("button", {
      name: "Enlarge signing",
      exact: true,
    });
    await enlarge.focus();
    await page.keyboard.press("Enter");
    const dialog = media.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close enlarged signing" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(enlarge).toBeFocused();
    await expect(media.locator(".sign-box video")).toHaveAttribute(
      "data-same-video",
      "yes",
    );
    await media
      .getByRole("button", { name: "Hide signing panel", exact: true })
      .click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
}

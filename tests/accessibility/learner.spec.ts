import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
async function openWidget(page: Page) {
  const widget = page.locator("db-assistant");
  await widget.locator(".panel").waitFor({ state: "attached" });
  if (!(await widget.locator(".panel").isVisible()))
    await widget.getByRole("button", { name: "Ask MELA", exact: true }).click();
  return widget;
}
for (const path of [
  "/",
  "/learn",
  "/jobs",
  "/support",
  "/demo/blank.html",
  "/savanna/pages/homepage-v1-paced.html",
  "/savanna/pages/homepage-v1-self-paced.html",
  "/savanna/pages/offline-first-localized-ai.html",
  "/savanna/pages/paced.html",
  "/savanna/pages/self-paced.html",
  "/savanna/pages/lesson.html",
]) {
  test(`accessible embed and source-backed answer on ${path}`, async ({
    page,
  }) => {
    await page.goto(path);
    const widget = await openWidget(page);
    const captured =
      path === "/" ||
      path === "/learn" ||
      path.includes("homepage-v1") ||
      path.includes("offline-first-localized");
    await widget
      .getByRole("textbox")
      .fill(captured ? "Explain my current lesson" : "How do I use a browser?");
    await widget
      .getByRole("button", { name: "Send question", exact: true })
      .click();
    await expect(widget.locator(".sources a").first()).toBeVisible();
    await page.addScriptTag({
      content: await readFile(require.resolve("axe-core/axe.min.js"), "utf8"),
    });
    const violations = await page.evaluate(async () => {
      const { violations } = await (
        window as unknown as {
          axe: {
            run: (context: Element | null) => Promise<{
              violations: { id: string; impact: string }[];
            }>;
          };
        }
      ).axe.run(document.querySelector("db-assistant"));
      return violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
    });
    expect(violations).toEqual([]);
  });
}
test("Amharic, keyboard close, small viewport and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/demo/digital-foundations");
  const widget = await openWidget(page);
  await widget.getByRole("combobox").selectOption("am");
  await widget.getByRole("textbox").fill("የይለፍ ቃል");
  await widget.getByRole("button", { name: "ጥያቄ ይላኩ", exact: true }).click();
  await expect(widget.locator(".sources a").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(widget.locator(".panel")).toBeHidden();
});
test("cached fixture reload and content retrieval work offline", async ({
  page,
  context,
}) => {
  await page.goto("/demo/blank.html");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.waitForTimeout(1000);
  await context.setOffline(true);
  await page.reload();
  const widget = await openWidget(page);
  await widget.getByRole("textbox").fill("password");
  await widget
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(widget.locator(".sources a").first()).toBeVisible();
  await expect(widget.locator(".status")).toContainText("Offline");
});
test("ticket creation and real tutor reply return to the learner", async ({
  page,
  playwright,
}) => {
  test.skip(
    process.env.E2E_DB !== "1",
    "Requires a migrated PostgreSQL database and tutor environment.",
  );
  await page.goto("/learn");
  const widget = await openWidget(page);
  await widget
    .getByRole("button", { name: "Talk to a person", exact: true })
    .click();
  await widget.getByLabel("Share this conversation", { exact: true }).check();
  await widget
    .getByLabel("I agree to share the selected information with a tutor", {
      exact: true,
    })
    .check();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/escalations") &&
      r.request().method() === "POST",
  );
  await widget
    .getByRole("button", { name: "Create support ticket", exact: true })
    .click();
  const { id } = await (await created).json();
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
  const tutor = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
  });
  try {
    expect(
      (
        await tutor.post("/api/v1/auth", {
          data: { password: process.env.ADMIN_PASSWORD },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await tutor.patch(`/api/v1/escalations/${id}`, {
          data: {
            reply: "Your tutor is here. Let’s take the next step together.",
          },
        })
      ).ok(),
    ).toBeTruthy();
    await expect(widget.locator(".messages")).toContainText(
      "Your tutor is here",
      { timeout: 15000 },
    );
  } finally {
    await tutor.dispose();
  }
});

import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
test("reading mode preserves privacy, expands text, announces complete answers and persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  let release: (() => void) | undefined;
  await page.route("**/api/v1/ask", async (route) => {
    await new Promise<void>((done) => (release = done));
    await route.fulfill({
      json: {
        answer: "Learn, then practice.",
        summary: "Learn, then practice.",
        matched: true,
        provider: "none",
        actions: [],
        citations: [
          { id: "s", title: "Lesson", url: "/learn", excerpt: "Practice" },
        ],
        blocks: [
          {
            kind: "diagram",
            title: "Learning path",
            description: "Learning comes before practice.",
            nodes: [
              { id: "a", label: "Learn" },
              { id: "b", label: "Practice" },
            ],
            edges: [{ from: "a", to: "b" }],
            sourceIds: ["s"],
          },
        ],
      },
    });
  });
  await page.goto("/demo/blank.html");
  const chat = page.locator("db-assistant");
  await chat.getByRole("button", { name: "Ask MELA", exact: true }).click();
  const mode = chat.getByRole("button", { name: "Reading mode", exact: true });
  await expect(mode).toHaveAttribute("aria-pressed", "false");
  await expect(
    chat.getByRole("combobox", { name: "Question context" }),
  ).toBeHidden();
  await mode.click();
  await expect(mode).toBeFocused();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  const log = chat.getByRole("log");
  await expect(log).toHaveAttribute("aria-live", "polite");
  await expect(log).toHaveAttribute("aria-relevant", "additions");
  await chat.getByRole("textbox").fill("Show a learning diagram");
  await chat.getByRole("textbox").press("Enter");
  await expect(log).toHaveAttribute("aria-busy", "true");
  await expect.poll(() => !!release).toBe(true);
  release!();
  await expect(chat.locator(".explanation-block details")).toHaveAttribute(
    "open",
    "",
  );
  await expect(chat.locator(".explanation-block details")).toContainText(
    "Practice",
  );
  await expect(chat.locator(".explanation-diagram")).toBeHidden();
  await expect(log).toHaveAttribute("aria-busy", "false");
  await expect(chat.getByRole("textbox")).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem("mela-reading-mode")),
  ).toBe("1");
  expect(
    await page.evaluate(() => window.speechSynthesis?.speaking || false),
  ).toBe(false);
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
  expect(
    await page.evaluate(async () => {
      const result = await (window as any).axe.run(
        document.querySelector("db-assistant"),
      );
      return result.violations
        .filter((v: any) => ["critical", "serious"].includes(v.impact))
        .map((v: any) => v.id);
    }),
  ).toEqual([]);
  await chat
    .locator(".panel")
    .screenshot({ path: "/tmp/mela-reading-mode.png" });
  await page.reload();
  await chat.getByRole("button", { name: "Ask MELA", exact: true }).click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "false");
  await chat.getByText("Learning options", { exact: true }).click();
  await expect(
    chat.getByRole("combobox", { name: "Question context" }),
  ).toBeVisible();
  await chat
    .getByRole("combobox", { name: "Language / ቋንቋ" })
    .selectOption("am");
  await expect(
    chat.getByRole("button", { name: "የንባብ ሁነታ", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("forced contrast and keyboard access keep core chat controls available", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("/demo/blank.html");
  const chat = page.locator("db-assistant");
  await chat.getByRole("button", { name: "Ask MELA", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(chat.getByRole("textbox")).toBeFocused();
  await chat.getByRole("button", { name: "Reading mode", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    chat.getByRole("button", { name: "Reading mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(
    chat.getByRole("button", { name: "Ask MELA", exact: true }),
  ).toBeFocused();
});

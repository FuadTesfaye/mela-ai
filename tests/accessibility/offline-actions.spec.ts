import { test, expect } from "@playwright/test";
test("downloaded course opens and answers after a reload with networking disabled", async ({
  page,
  context,
}) => {
  await page.goto("/offline.html");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Offline-First & Localized AI",
      exact: true,
    }),
  });
  await card
    .getByRole("button", { name: "Download course", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Open saved course" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  // Choose the specific course after reload rather than relying on the available-catalogue order.
  const saved = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Offline-First & Localized AI",
      exact: true,
    }),
  });
  await saved.getByRole("button", { name: "Open saved course" }).click();
  await page
    .getByLabel("Ask about this saved course")
    .fill("What is quantization?");
  await page.getByRole("button", { name: "Search saved lessons" }).click();
  await expect(page.locator("#answer")).toContainText(/quantiz/i);
  await expect(page.locator("#answer a").first()).toHaveAttribute(
    "href",
    /^#offline-first/,
  );
  await page.getByText("Read saved video captions").click();
  await expect(page.locator("#lesson-content")).toContainText("multimodal");
});
test("web actions require confirmation and reject stale or sensitive targets", async ({
  page,
}) => {
  await page.goto("/demo/actions.html");
  const host = page.locator("[data-mela-actions-ui]");
  await host.locator("summary").click();
  const command = host.getByRole("textbox", { name: "Web command" });
  await command.fill("fill Practice name with Hana");
  await host.getByRole("button", { name: "Run command", exact: true }).click();
  await expect(page.getByLabel("Practice name")).toHaveValue("");
  await host
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.getByLabel("Practice name")).toHaveValue("Hana");
  await command.fill("click Submit practice task");
  await host.getByRole("button", { name: "Run command", exact: true }).click();
  await expect(page.locator("#result")).toBeEmpty();
  await host
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(page.locator("#result")).toContainText("No data was sent");
  await command.fill("click Submit practice task");
  await host.getByRole("button", { name: "Run command", exact: true }).click();
  await page
    .locator("form button")
    .evaluate((e) => (e.textContent = "Changed target"));
  await host
    .getByRole("button", { name: "Confirm action", exact: true })
    .click();
  await expect(host.getByRole("status")).toContainText("changed");
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.type = "password";
    input.setAttribute("aria-label", "Password");
    document.querySelector("main")!.append(input);
  });
  await command.fill("fill Password with hidden");
  await host.getByRole("button", { name: "Run command", exact: true }).click();
  await expect(host.getByRole("status")).toContainText("No visible control");
  await command.press("Escape");
  await expect(host.locator("details")).not.toHaveAttribute("open", "");
});

test("insufficient storage is actionable and does not publish a partial course", async ({
  page,
}) => {
  await page.goto("/offline.html");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.evaluate(() =>
    Object.defineProperty(navigator.storage, "estimate", {
      configurable: true,
      value: async () => ({ quota: 1, usage: 1 }),
    }),
  );
  const card = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Virtual Assistant Foundations",
        exact: true,
      }),
    });
  await card
    .getByRole("button", { name: "Download course", exact: true })
    .click();
  await expect(page.locator("#status")).toContainText(
    "Not enough device storage",
  );
  await expect(
    card.getByRole("button", { name: "Open saved course" }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Retry / resume download" }),
  ).toBeVisible();
});

import { test, expect, type Page } from "@playwright/test";
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
async function openChat(page: Page) {
  await page.goto("/demo/blank.html");
  const chat = page.locator("db-assistant");
  await chat.locator(".launcher").click();
  return chat;
}
async function nativeSpeech(page: Page) {
  await page.addInitScript(() => {
    class Speech {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart?: () => void;
      onresult?: (event: unknown) => void;
      onerror?: (event: { error: string }) => void;
      onend?: () => void;
      start() {
        (window as any).speech = this;
        queueMicrotask(() => this.onstart?.());
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    (window as any).SpeechRecognition = Speech;
  });
}
test("microphone dictation keeps a draft, updates interim text, and never auto-sends", async ({
  page,
}) => {
  await nativeSpeech(page);
  page.on("dialog", (dialog) => dialog.accept());
  const chat = await openChat(page);
  await chat.getByRole("textbox").fill("My question:");
  await chat
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(chat.locator("[data-voice-state]")).toHaveAttribute(
    "data-voice-state",
    "listening",
  );
  await page.evaluate(() => {
    const s = (window as any).speech;
    s.onresult({
      results: [Object.assign([{ transcript: "explain" }], { isFinal: false })],
    });
  });
  await expect(chat.getByRole("textbox")).toHaveValue("My question: explain");
  await page.evaluate(() => {
    const s = (window as any).speech;
    s.onresult({
      results: [
        Object.assign([{ transcript: "explain this lesson" }], {
          isFinal: true,
        }),
      ],
    });
    s.onend();
  });
  await expect(chat.getByRole("textbox")).toHaveValue(
    "My question: explain this lesson",
  );
  await expect(chat.locator(".status")).toContainText("Transcript ready");
  await expect(chat.locator(".message.user")).toHaveCount(0);
  await expect(
    chat.getByRole("button", { name: "Use microphone", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
test("permission denial is actionable and changing language stops a live microphone", async ({
  page,
}) => {
  await nativeSpeech(page);
  page.on("dialog", (dialog) => dialog.accept());
  const chat = await openChat(page);
  await chat
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await page.evaluate(() =>
    (window as any).speech.onerror({ error: "not-allowed" }),
  );
  await expect(chat.locator(".status")).toContainText("permission was denied");
  await chat
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(chat.locator("[data-voice-state]")).toHaveAttribute(
    "data-voice-state",
    "listening",
  );
  await chat
    .getByRole("combobox", { name: "Language / ቋንቋ" })
    .selectOption("am");
  await expect(chat).toHaveAttribute("lang", "am");
  await expect(chat.locator(".mic-active")).toHaveCount(0);
});
test("MediaRecorder captures real browser audio and sends it only to the consented relay", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
    });
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as any).capturedStream = stream;
      return stream;
    };
  });
  let calls = 0;
  await page.route("**/api/v1/speech", async (route) => {
    calls++;
    const data = route.request().postDataJSON();
    expect(data.consent).toBe(true);
    expect(data.audio.length).toBeGreaterThan(20);
    expect(data.mimeType).toMatch(/^audio\//);
    await route.fulfill({
      json: { text: "Explain my current lesson.", language: "en" },
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
  const chat = await openChat(page);
  await chat
    .getByRole("button", { name: "Use microphone", exact: true })
    .click();
  await expect(chat.locator("[data-voice-state]")).toHaveAttribute(
    "data-voice-state",
    "recording",
  );
  await page.waitForTimeout(400);
  await chat
    .getByRole("button", { name: "Stop microphone", exact: true })
    .click();
  await expect(chat.getByRole("textbox")).toHaveValue(
    "Explain my current lesson.",
  );
  expect(calls).toBe(1);
  expect(
    await page.evaluate(() =>
      (window as any).capturedStream
        .getTracks()
        .every((track: MediaStreamTrack) => track.readyState === "ended"),
    ),
  ).toBe(true);
});
test("browser-first source answers work with every API disabled", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/**", (route) => {
    calls++;
    return route.abort();
  });
  const chat = await openChat(page);
  await chat.getByRole("textbox").fill("How do I keep a password safe?");
  await chat.getByRole("textbox").press("Enter");
  await expect(chat.locator(".message").last()).toContainText(
    "unique password",
  );
  await expect(chat.locator(".sources a").first()).toBeVisible();
  expect(calls).toBe(0);
});

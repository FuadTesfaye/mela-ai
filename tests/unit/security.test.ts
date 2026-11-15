import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  isAdmin,
  requireAdmin,
  hash,
  equal,
} from "../../lib/security/auth";
import { askSchema, section } from "../../lib/security/schemas";
import { validateScreenshot } from "../../lib/support/tickets";
import { smsText, channelAnswer } from "../../lib/channels/transports";
import { validateGenerated } from "../../lib/ai/answer";
import { webhookUrl } from "../../lib/security/webhooks";
process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
process.env.APP_URL = "http://localhost:3000";
test("signed sessions authorize and reject tampering", () => {
  const value = createSession();
  assert.ok(
    isAdmin(
      new Request("http://localhost:3000", {
        headers: { cookie: "mela_session=" + value },
      }),
    ),
  );
  assert.equal(
    isAdmin(
      new Request("http://localhost:3000", {
        headers: { cookie: "mela_session=" + value + "x" },
      }),
    ),
    false,
  );
});
test("admin mutations require same-origin requests", () =>
  assert.throws(() =>
    requireAdmin(
      new Request("http://localhost:3000", {
        method: "POST",
        headers: {
          cookie: "mela_session=" + createSession(),
          origin: "https://attacker.example",
        },
      }),
    ),
  ));
test("unsafe citation URLs are rejected", () => {
  assert.equal(
    section.safeParse({
      id: "x",
      title: "x",
      content: "x",
      url: "javascript:alert(1)",
    }).success,
    false,
  );
});
test("oversized questions and unexpected language fail validation", () => {
  assert.equal(
    askSchema.safeParse({ question: "x".repeat(2001) }).success,
    false,
  );
  assert.equal(
    askSchema.safeParse({ question: "x", language: "unsupported" }).success,
    false,
  );
});
test("screenshots require valid image magic bytes", () => {
  assert.throws(() =>
    validateScreenshot(
      "data:image/png;base64," +
        Buffer.from("<script>bad</script>").toString("base64"),
    ),
  );
  validateScreenshot(
    "data:image/png;base64," +
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64"),
  );
});
test("text replies are capped at 160 Unicode codepoints", () => {
  assert.equal(Array.from(smsText("ሰ".repeat(200))).length, 160);
  assert.equal(smsText("hi"), "hi");
});
test("generated source ids must come from retrieval", () => {
  assert.throws(() =>
    validateGenerated(
      JSON.stringify({ answer: "Invented", sourceIds: ["fake"] }),
      {
        answer: "source",
        provider: "none",
        matched: true,
        actions: [],
        citations: [{ id: "real", title: "real", url: "/", excerpt: "source" }],
      },
    ),
  );
});
test("hash comparisons and webhook host restrictions", () => {
  assert.ok(equal(hash("abc"), hash("abc")));
  assert.equal(equal("a", "ab"), false);
  process.env.WEBHOOK_ALLOWED_HOSTS = "hooks.example.com";
  assert.throws(() => webhookUrl("https://127.0.0.1/private"));
  assert.throws(() => webhookUrl("http://hooks.example.com"));
  assert.equal(
    webhookUrl("https://hooks.example.com/events").hostname,
    "hooks.example.com",
  );
});

test("channel answer formatting reserves room for source citations", () => {
  const answer = {
    answer: "Detailed lesson text. ".repeat(1000),
    provider: "none" as const,
    matched: true,
    actions: [],
    citations: [
      {
        id: "lesson",
        title: "Lesson",
        url: "/learn#lesson",
        excerpt: "source",
      },
    ],
  };
  const telegram = channelAnswer(answer, "telegram", "https://mela.example");
  assert.ok(Array.from(telegram).length <= 4000);
  assert.ok(telegram.endsWith("https://mela.example/learn#lesson"));
  const sms = channelAnswer(answer, "sms", "https://mela.example");
  assert.ok(Array.from(sms).length <= 160);
  assert.ok(sms.endsWith("https://mela.example/learn#lesson"));
});

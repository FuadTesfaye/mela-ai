import { test } from "node:test";
import assert from "node:assert/strict";
import prepared from "../../data/localization/am-prepared.json";
import content from "../../data/content.json";
import {
  preparedTranslator,
  lessonItems,
  translationValid,
} from "../../lib/localization/shared";
import {
  translateItems,
  translationRequestSchema,
  sourceRevision,
  protectText,
  amharicGlossary,
} from "../../lib/localization/service";
import { groundedAnswer } from "../../lib/retrieval/search";
import { answerQuestion } from "../../lib/ai/answer";
import { POST, OPTIONS } from "../../app/api/v1/translations/route";
import type { Section } from "../../lib/types";
const translate = preparedTranslator(prepared.entries);
const locale = { translate, glossary: amharicGlossary };
const context = {
  pageType: "lesson" as const,
  courseId: "offline-first-localized-ai",
  sections: [],
};
test("every prepared English knowledge section has Amharic title and body drafts", () => {
  for (const section of content.filter((s) => s.language === "en")) {
    assert.match(translate(section.title) || "", /[\u1200-\u137f]/);
    assert.ok(translate(section.content), section.id);
  }
});
test("Amharic questions retrieve English course sources and return prepared Amharic with canonical citations", () => {
  const result = groundedAnswer(
    "ኳንታይዜሽን ምንድን ነው?",
    content as Section[],
    context,
    "am",
    false,
    locale,
  );
  assert.equal(result.language, "am");
  assert.equal(result.translationStatus, "prepared");
  assert.ok(result.citations.some((c) => c.id === "offline-ai-slide-07"));
  assert.match(result.answer, /4-bit/);
  assert.match(result.answer, /[\u1200-\u137f]/);
  assert.ok(
    result.citations.every((c) => c.url.includes("offline-first-localized-ai")),
  );
  assert.equal(
    groundedAnswer(
      "quantization",
      content as Section[],
      { ...context, courseId: "unrelated" },
      "am",
      false,
      locale,
    ).matched,
    false,
  );
});
test("English questions can request Amharic answers and unavailable translations are labelled source-only", () => {
  const result = groundedAnswer(
    "What is quantization?",
    content as Section[],
    context,
    "am",
    false,
    locale,
  );
  assert.equal(result.language, "am");
  const current = {
    id: "new",
    title: "Sensor lesson",
    content: "A sensor measures temperature.",
    url: "/sensors",
    language: "en" as const,
  };
  const fallback = groundedAnswer(
    "sensor",
    [],
    { pageType: "lesson", sections: [current] },
    "am",
    false,
    locale,
  );
  assert.equal(fallback.language, "en");
  assert.equal(fallback.translationStatus, "source-only");
  assert.match(fallback.notice!, /እንግሊዝኛ/);
  assert.equal(fallback.citations[0].id, "new");
});
test("prepared translation requires no key or cloud consent and hashes the exact source", async () => {
  const item = { id: "title", text: "Using a web browser" };
  const result = await translateItems({ targetLanguage: "am", items: [item] });
  assert.equal(result.provenance, "prepared");
  assert.equal(result.sourceRevision, sourceRevision([item]));
  assert.match(result.items[0].text, /አሳሽ/);
  assert.equal(translationValid(result, [item]), true);
  assert.equal(
    translationValid({ ...result, items: [{ id: "wrong", text: "ሰላም" }] }, [
      item,
    ]),
    false,
  );
  assert.notEqual(
    sourceRevision([item]),
    sourceRevision([{ ...item, text: item.text + " updated" }]),
  );
});
test("translation bounds, duplicate IDs and missing consent fail before the provider", async () => {
  assert.equal(
    translationRequestSchema.safeParse({
      targetLanguage: "am",
      items: [
        { id: "a", text: "a" },
        { id: "a", text: "b" },
      ],
    }).success,
    false,
  );
  assert.equal(
    translationRequestSchema.safeParse({
      targetLanguage: "am",
      items: [{ id: "a", text: "a".repeat(3001) }],
    }).success,
    false,
  );
  assert.equal(
    translationRequestSchema.safeParse({
      targetLanguage: "fr",
      items: [{ id: "a", text: "hello" }],
    }).success,
    false,
  );
  await assert.rejects(
    () =>
      translateItems({
        targetLanguage: "am",
        items: [{ id: "new", text: "Previously unseen lesson text." }],
      }),
    (e) => (e as { status: number }).status === 403,
  );
});
test("code splitting and protected tokens retain code, URLs, numbers and identifiers", () => {
  const source = "Read this.\n```python\nprint(42)\n```\nNext paragraph.";
  const chunks = lessonItems("s", source);
  assert.equal(
    chunks.find((c) => c.kind === "code")?.text,
    "```python\nprint(42)\n```",
  );
  assert.ok(
    lessonItems("long", "word ".repeat(1000)).every(
      (c) => c.text.length <= 3000,
    ),
  );
  const protectedText = protectText(
    "Use RAG with Python 3.12 and `print(42)` at https://example.org.",
  );
  const restored = protectedText.restore("ትምህርት፦ " + protectedText.masked);
  assert.match(restored, /RAG/);
  assert.match(restored, /Python 3.12/);
  assert.match(restored, /`print\(42\)`/);
  assert.match(restored, /https:\/\/example.org/);
  assert.throws(() => protectedText.restore("ትርጉም ግን የተጠበቀው ኮድ ጠፍቷል።"));
});
async function mockProvider(run: () => Promise<void>) {
  const before = {
    fetch: globalThis.fetch,
    key: process.env.GEMINI_API_KEY,
    provider: process.env.AI_PROVIDER,
  };
  process.env.GEMINI_API_KEY = "test-not-a-real-key";
  process.env.AI_PROVIDER = "gemini";
  try {
    await run();
  } finally {
    globalThis.fetch = before.fetch;
    if (before.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = before.key;
    if (before.provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = before.provider;
  }
}
test("live translation validates provider IDs, restores protected literals and coalesces concurrent work", async () =>
  mockProvider(async () => {
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const prompt = body.contents[0].parts[0].text as string;
      const items = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1)) as {
        id: string;
        text: string;
      }[];
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: items.map((i) => ({
                      ...i,
                      text: "ትምህርት፦ " + i.text,
                    })),
                  }),
                },
              ],
            },
          },
        ],
      });
    };
    const request = {
      targetLanguage: "am" as const,
      cloudConsent: true,
      items: [{ id: "x", text: "Use Python 3.12 for this unique unit test." }],
    };
    const [a, b] = await Promise.all([
      translateItems(request),
      translateItems(request),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
    assert.match(a.items[0].text, /Python 3.12/);
    assert.equal(a.provenance, "ai-draft");
  }));
test("bad model translations and quota failures preserve honest error states", async () =>
  mockProvider(async () => {
    globalThis.fetch = async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: [{ id: "other", text: "ሐሰተኛ" }],
                  }),
                },
              ],
            },
          },
        ],
      });
    const request = {
      targetLanguage: "am" as const,
      cloudConsent: true,
      items: [{ id: "x", text: "Unseen paragraph for failure handling." }],
    };
    await assert.rejects(
      () => translateItems(request),
      (e) => (e as { status: number }).status === 502,
    );
    globalThis.fetch = async () => new Response("quota", { status: 429 });
    await assert.rejects(
      () => translateItems(request),
      (e) => (e as { status: number }).status === 429,
    );
  }));
test("Amharic AI prose must actually contain Amharic and invalid output falls back to prepared evidence", async () =>
  mockProvider(async () => {
    globalThis.fetch = async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: "English only.",
                    sourceIds: ["offline-ai-slide-07"],
                    blocks: [],
                  }),
                },
              ],
            },
          },
        ],
      });
    const answer = await answerQuestion({
      question: "quantization",
      language: "am",
      context,
      cloudConsent: true,
    });
    assert.equal(answer.language, "am");
    assert.equal(answer.provider, "none");
    assert.match(answer.answer, /[\u1200-\u137f]/);
  }));
test("translation route enforces CORS, consent and public prepared responses", async () => {
  const headers = {
    origin: "http://localhost:3000",
    "Content-Type": "application/json",
  };
  const response = await POST(
    new Request("http://localhost:3000/api/v1/translations", {
      method: "POST",
      headers,
      body: JSON.stringify({
        targetLanguage: "am",
        items: [{ id: "a", text: "Using a web browser" }],
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).provenance, "prepared");
  const denied = await POST(
    new Request("http://localhost:3000/api/v1/translations", {
      method: "POST",
      headers: { ...headers, origin: "https://unapproved.test" },
      body: "{}",
    }),
  );
  assert.equal(denied.status, 403);
  const preflight = await OPTIONS(
    new Request("http://localhost:3000/api/v1/translations", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  assert.equal(preflight.status, 204);
});

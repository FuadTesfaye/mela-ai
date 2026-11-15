import { test } from "node:test";
import assert from "node:assert/strict";
import { geminiGenerate } from "../../lib/ai/providers/gemini";
import { answerQuestion } from "../../lib/ai/answer";
async function configured(run: () => Promise<void>) {
  const saved = {
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    provider: process.env.AI_PROVIDER,
    fetch: globalThis.fetch,
  };
  process.env.GEMINI_API_KEY = "test-key-not-a-real-credential";
  process.env.GEMINI_MODEL = "test-model";
  process.env.AI_PROVIDER = "gemini";
  try {
    await run();
  } finally {
    for (const [name, value] of [
      ["GEMINI_API_KEY", saved.key],
      ["GEMINI_MODEL", saved.model],
      ["AI_PROVIDER", saved.provider],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
    globalThis.fetch = saved.fetch;
  }
}
test("Gemini uses server-side header authentication and parses structured text", async () =>
  configured(async () => {
    let endpoint = "";
    globalThis.fetch = async (input, init) => {
      endpoint = String(input);
      assert.equal(
        new Headers(init?.headers).get("x-goog-api-key"),
        "test-key-not-a-real-credential",
      );
      assert.equal(
        JSON.parse(String(init?.body)).contents[0].parts[0].text,
        "Public evidence",
      );
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                { thought: true, text: "do not expose" },
                { text: '{"answer":"source"}' },
              ],
            },
          },
        ],
      });
    };
    const text = await geminiGenerate([{ text: "Public evidence" }]);
    assert.equal(text, '{"answer":"source"}');
    assert.ok(!endpoint.includes("test-key"));
  }));
test("Gemini never receives page context without cloud-sharing consent", async () =>
  configured(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error("No call expected");
    };
    const result = await answerQuestion({
      question: "password",
      cloudConsent: false,
    });
    assert.equal(result.provider, "none");
    assert.equal(calls, 0);
  }));
test("Gemini validates citations and degrades transparently on provider failure", async () =>
  configured(async () => {
    globalThis.fetch = async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [
                {
                  text: '{"answer":"Use a unique password.","sourceIds":["password-en"]}',
                },
              ],
            },
          },
        ],
      });
    const generated = await answerQuestion({
      question: "password",
      cloudConsent: true,
    });
    assert.equal(generated.provider, "gemini");
    globalThis.fetch = async () => new Response("invalid key", { status: 403 });
    const fallback = await answerQuestion({
      question: "password",
      cloudConsent: true,
    });
    assert.equal(fallback.provider, "none");
    assert.match(fallback.notice || "", /source text/);
    assert.ok(fallback.citations.length);
  }));

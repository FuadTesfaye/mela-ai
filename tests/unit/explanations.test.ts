import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGenerated, answerQuestion } from "../../lib/ai/answer";
import type { Answer } from "../../lib/types";
const base: Answer = {
  answer: "source",
  provider: "none",
  matched: true,
  actions: [],
  citations: [
    { id: "s1", title: "Source", url: "/source", excerpt: "Practice." },
  ],
};
const diagram = {
  kind: "diagram",
  title: "Learning path",
  description: "Practice follows learning.",
  nodes: [
    { id: "learn", label: "Learn" },
    { id: "practice", label: "Practice" },
  ],
  edges: [{ from: "learn", to: "practice" }],
  sourceIds: ["s1"],
};
test("structured explanations preserve text-only clients and validate diagram edges", () => {
  const result = validateGenerated(
    JSON.stringify({
      answer: "Learn, then practice.",
      sourceIds: ["s1"],
      blocks: [diagram],
    }),
    base,
  );
  assert.equal(result.blocks?.[0].kind, "diagram");
  assert.match(result.answer, /Learn → Practice/);
  assert.throws(() =>
    validateGenerated(
      JSON.stringify({
        answer: "Bad",
        sourceIds: ["s1"],
        blocks: [{ ...diagram, edges: [{ from: "missing", to: "learn" }] }],
      }),
      base,
    ),
  );
  assert.throws(() =>
    validateGenerated(
      JSON.stringify({
        answer: "Bad",
        sourceIds: ["s1"],
        blocks: [{ ...diagram, sourceIds: ["fake"] }],
      }),
      base,
    ),
  );
});
test("diagram schema rejects raw SVG and excessive graph data", () => {
  assert.throws(() =>
    validateGenerated(
      JSON.stringify({
        answer: "Bad",
        sourceIds: ["s1"],
        blocks: [{ ...diagram, svg: "<script>bad</script>" }],
      }),
      base,
    ),
  );
  assert.throws(() =>
    validateGenerated(
      JSON.stringify({
        answer: "Bad",
        sourceIds: ["s1"],
        blocks: [
          {
            ...diagram,
            nodes: Array.from({ length: 9 }, (_, i) => ({
              id: String(i),
              label: "Node",
            })),
          },
        ],
      }),
      base,
    ),
  );
});
test("visual explanations receive the actual bounded video only after consent", async () => {
  const saved = {
    provider: process.env.AI_PROVIDER,
    key: process.env.GEMINI_API_KEY,
    fetch: globalThis.fetch,
  };
  process.env.AI_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-only";
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(
      body.contents[0].parts[0].fileData.fileUri,
      "https://www.youtube.com/watch?v=bJzb-RuUcMU",
    );
    assert.deepEqual(body.contents[0].parts[0].videoMetadata, {
      startOffset: "105s",
      endOffset: "135s",
    });
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  answer: "The screen shows a learning example.",
                  sourceIds: ["moment-bJzb-RuUcMU-120"],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  try {
    const context = {
      pageType: "lesson" as const,
      sections: [],
      video: {
        videoId: "bJzb-RuUcMU",
        url: "https://youtu.be/bJzb-RuUcMU",
        title: "Programming",
        currentTime: 120,
        duration: 270,
      },
    };
    const noConsent = await answerQuestion({
      question: "Explain the screen",
      scope: "moment",
      includeVisualContext: true,
      cloudConsent: false,
      context,
    });
    assert.equal(noConsent.citations.some(c => c.id.startsWith("moment-")), false);
    assert.equal(calls, 0);
    const result = await answerQuestion({
      question: "Explain the screen",
      scope: "moment",
      includeVisualContext: true,
      cloudConsent: true,
      context,
    });
    assert.equal(result.provider, "gemini");
    assert.match(result.citations[0].url, /t=120/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [name, value] of [
      ["AI_PROVIDER", saved.provider],
      ["GEMINI_API_KEY", saved.key],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { groundedAnswer, tokenize } from "../../lib/retrieval/search";
import content from "../../data/content.json";
import type { Section, LearningContext } from "../../lib/types";
const sections = content as Section[];
const context: LearningContext = {
  pageType: "lesson",
  courseId: "digital-foundations",
  sections: [],
};
test("English questions return relevant cited source material", () => {
  const result = groundedAnswer(
    "How do I keep a password safe?",
    sections,
    context,
    "en",
  );
  assert.equal(result.matched, true);
  assert.equal(result.citations[0].id, "password-en");
  assert.match(result.answer, /unique password/);
});
test("Amharic questions retrieve Amharic content", () => {
  const result = groundedAnswer("የይለፍ ቃል", sections, context, "am");
  assert.equal(result.citations[0].id, "password-am");
  assert.match(result.answer, /የይለፍ/);
  assert.ok(result.citations.every((c) => c.id.endsWith("-am")));
});
test("no evidence gives no answer and offers human help", () => {
  const result = groundedAnswer(
    "quantum entanglement",
    sections,
    context,
    "en",
  );
  assert.equal(result.matched, false);
  assert.equal(result.citations.length, 0);
  assert.deepEqual(result.actions, ["human-help"]);
});
test("current page wins over broader content", () => {
  const current = {
    id: "active",
    title: "Password",
    content: "This lesson teaches password storage.",
    url: "/current",
    language: "en" as const,
  };
  const result = groundedAnswer(
    "password",
    sections,
    { ...context, sections: [current] },
    "en",
  );
  assert.equal(result.citations[0].id, "active");
});
test("unrelated course material is excluded", () => {
  const result = groundedAnswer(
    "password",
    sections,
    { ...context, courseId: "another-course" },
    "en",
  );
  assert.equal(result.matched, false);
});
test("simple mode extracts shorter source sentences", () => {
  const normal = groundedAnswer("browser", sections, context, "en");
  const simple = groundedAnswer("browser", sections, context, "en", true);
  assert.ok(simple.answer.length < normal.answer.length);
  assert.deepEqual(simple.citations, normal.citations);
});
test("tokenization retains Ethiopic characters", () =>
  assert.ok(tokenize("የይለፍ ቃል").includes("የይለፍ")));
test("current page content overrides a stale indexed section with the same id", () => {
  const current = {
    ...sections.find((s) => s.id === "password-en")!,
    content: "The updated password lesson is on this page.",
  };
  const result = groundedAnswer(
    "password",
    sections,
    { ...context, sections: [current] },
    "en",
  );
  assert.match(result.answer, /updated password lesson/);
});
test("supplied offline-first training is searchable with slide-level citations", () => {
  const training = {
    pageType: "lesson" as const,
    courseId: "offline-first-localized-ai",
    sections: [],
  };
  const result = groundedAnswer(
    "What is quantization?",
    sections,
    training,
    "en",
  );
  assert.equal(result.matched, true);
  assert.match(result.answer, /4-bit/);
  assert.ok(
    result.citations.some((c) =>
      c.url.includes("offline-first-localized-ai.html#offline-ai-slide-07"),
    ),
  );
});

import {
  preparedTranslator,
  type PreparedEntry,
} from "../../lib/localization/shared";
import {
  groundedAnswer,
  type RetrievalLocale,
} from "../../lib/retrieval/search";
import type { Language, LearningContext, Section } from "../../lib/types";
let knowledge: Section[] = [];
let locale: RetrievalLocale | undefined;
export function setAmEvidence(
  entries: PreparedEntry[],
  glossary: Record<string, string[]>,
) {
  locale = { translate: preparedTranslator(entries), glossary };
}
function valid(data: unknown): data is Section[] {
  return (
    Array.isArray(data) &&
    data.length <= 1000 &&
    data.every(
      (s) =>
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        typeof s.content === "string" &&
        typeof s.url === "string",
    )
  );
}
export async function loadKnowledge(url: string) {
  const key = "mela-content:" + new URL(url, location.href).href;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("content");
    const data = await response.json();
    if (!valid(data)) throw new Error("format");
    knowledge = data.map((s) => ({
      ...s,
      url: new URL(s.url, new URL(url, location.href)).href,
    }));
    try {
      localStorage.setItem(key, JSON.stringify(knowledge));
    } catch {}
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || "[]");
      if (valid(cached)) knowledge = cached;
    } catch {}
  }
  return knowledge;
}
export async function offlineAnswer(
  question: string,
  language: Language,
  context: LearningContext,
  simple = false,
) {
  return groundedAnswer(question, knowledge, context, language, simple, locale);
}

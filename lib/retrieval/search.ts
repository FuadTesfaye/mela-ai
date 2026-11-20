import { languageNotice } from "../languages";
import type { Section, LearningContext, Language, Answer } from "../types";
const stop = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "of",
  "to",
  "in",
  "on",
  "for",
  "i",
  "my",
  "me",
  "it",
  "how",
  "what",
  "do",
  "can",
  "please",
  "explain",
  "current",
  "lesson",
  "help",
  "with",
  "and",
  "በ",
  "የ",
  "ነው",
  "ምን",
  "እንዴት",
  "እርዳኝ",
]);
export function tokenize(text: string) {
  return [
    ...new Set(
      text
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1 && !stop.has(t)),
    ),
  ];
}
const bilingual: Record<string, string[]> = {
  password: ["የይለፍ", "ቃል", "ደህንነት"],
  browser: ["አሳሽ", "በይነመረብ"],
  internet: ["በይነመረብ", "ኢንተርኔት"],
  job: ["ሥራ", "ስራ"],
  interview: ["ቃለ", "መጠይቅ"],
  offline: ["መስመር", "ውጭ"],
  email: ["ኢሜይል"],
  learning: ["ትምህርት", "ተማር"],
};
export interface RetrievalLocale {
  translate: (text: string) => string | undefined;
  glossary?: Record<string, string[]>;
}
export function retrieve(
  question: string,
  sections: Section[],
  context: LearningContext,
  language: Language,
  locale?: RetrievalLocale,
): Section[] {
  const q = tokenize(question);
  for (const [en, am] of Object.entries({ ...bilingual, ...locale?.glossary }))
    if (q.some((t) => t === en || am.some((a) => t.includes(a))))
      q.push(en, ...am);
  const videoScope = /\b(video|transcript)\b|ቪዲዮ/i.test(question);
  const contextual =
    /current lesson|this lesson|this page|current page|summari[sz]e|transcript|this video|the video|የአሁኑ|ትምህርት|በአማርኛ|ይህን|ይህ|አብራራ|አጠቃልል/.test(
      question.toLowerCase(),
    );
  const unique = new Map<string, Section>();
  for (const s of [...sections, ...context.sections])
    if (
      (!s.courseId ||
        !context.courseId ||
        s.courseId === context.courseId ||
        context.pageType === "jobs") &&
      (!s.language || s.language === language || language === "am")
    )
      unique.set(s.id, s);
  const active = new Set(context.sections.map((s) => s.id));
  const hasVideo = context.sections.some((s) => s.id.startsWith("video-"));
  return [...unique.values()]
    .filter(
      (s) =>
        language !== "am" ||
        (!(
          s.id.endsWith("-en") &&
          unique.has(s.id.slice(0, -3) + "-am") &&
          !active.has(s.id)
        ) &&
          !(s.id.endsWith("-am") && active.has(s.id.slice(0, -3) + "-en"))),
    )
    .filter((s) => !videoScope || !hasVideo || s.id.startsWith("video-"))
    .map((s) => {
      const title = tokenize(
        s.title +
          " " +
          (s.keywords || []).join(" ") +
          " " +
          (locale?.translate(s.title) || ""),
      );
      const body = tokenize(
        s.content + " " + (locale?.translate(s.content) || ""),
      );
      const overlap = q.reduce(
        (n, t) => n + (title.includes(t) ? 3 : body.includes(t) ? 1 : 0),
        0,
      );
      const contextualMatch =
        contextual && (active.has(s.id) || s.courseId === context.courseId);
      return {
        s,
        score:
          overlap > 0
            ? overlap + (active.has(s.id) ? 8 : 0)
            : contextualMatch
              ? 2
              : 0,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.s);
}
export function groundedAnswer(
  question: string,
  sections: Section[],
  context: LearningContext,
  language: Language,
  simple = false,
  locale?: RetrievalLocale,
): Answer {
  if (language === "om" || language === "ti")
    return {
      ...groundedAnswer(question, sections, context, "en", simple, locale),
      notice: languageNotice(language),
      translationStatus: "source-only",
    };
  const found = retrieve(question, sections, context, language, locale);
  const localized = found.map((s) => {
    const translated =
      language === "am" && s.language !== "am"
        ? locale?.translate(s.content)
        : undefined;
    return translated
      ? {
          ...s,
          content: translated,
          title: locale?.translate(s.title) || s.title,
          language: "am" as const,
        }
      : s;
  });
  const sourceOnly =
    language === "am" && localized.some((s) => s.language !== "am");
  const shown = sourceOnly
    ? found.filter((s) => s.language !== "am")
    : localized;
  const sentences = (text: string) =>
    simple
      ? text
          .split(/(?<=[.!?።])\s*/u)
          .filter(Boolean)
          .slice(0, 2)
          .join(" ")
      : text;
  return {
    language: sourceOnly ? "en" : language,
    translationStatus: sourceOnly
      ? "source-only"
      : language === "am"
        ? "prepared"
        : undefined,
    notice: sourceOnly ? "የአማርኛ ትርጉም አይገኝም። የእንግሊዝኛ ምንጩን እያሳየሁ ነው።" : undefined,
    answer: found.length
      ? shown.map((s) => sentences(s.content)).join("\n\n")
      : language === "am"
        ? "ይህን መረጃ በትምህርቱ ውስጥ ማግኘት አልቻልኩም። ጥያቄዎን በሌላ መንገድ ይጠይቁ ወይም የሰው እርዳታ ይጠይቁ።"
        : "I couldn’t find this in the lesson sources. Try another question or ask a person.",
    citations: shown.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      excerpt: s.content.slice(0, 240),
    })),
    provider: "none",
    matched: found.length > 0,
    actions: ["human-help"],
  };
}

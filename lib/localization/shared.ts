export type TranslationItem = {
  id: string;
  text: string;
  kind?: "text" | "code";
};
export type TranslationPack = {
  version: 1;
  sourceLanguage: "en";
  targetLanguage: "am";
  sourceRevision: string;
  provenance: "prepared" | "ai-draft";
  items: { id: string; text: string }[];
};
export type PreparedEntry = { sourceText: string; targetText: string };
export type AmharicPack = {
  version: 1;
  glossaryVersion: string;
  status: "ai-draft";
  entries: PreparedEntry[];
  ui: Record<string, string>;
  glossary: Record<string, string[]>;
};
export const normalizeSource = (text: string) =>
  text.normalize("NFC").replace(/\s+/g, " ").trim();
export const canonicalSource = (items: readonly TranslationItem[]) =>
  JSON.stringify({
    version: 1,
    glossary: "am-1",
    source: "en",
    target: "am",
    items: items.map((i) => ({
      id: i.id,
      text: i.text,
      kind: i.kind || "text",
    })),
  });
export function preparedTranslator(entries: readonly PreparedEntry[]) {
  const map = new Map(
    entries.map((entry) => [
      normalizeSource(entry.sourceText),
      entry.targetText,
    ]),
  );
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  return (text: string): string | undefined => {
    const original = normalizeSource(text);
    if (map.has(original)) return map.get(original);
    let remaining = original;
    const output: string[] = [];
    // Source transcript groups and DOM paragraphs can concatenate exact entries.
    while (remaining) {
      const key = keys.find((key) => remaining.startsWith(key));
      if (!key) return;
      output.push(map.get(key)!);
      remaining = remaining.slice(key.length).trimStart();
    }
    return output.length ? output.join("\n") : undefined;
  };
}
export function translationValid(
  value: unknown,
  items: readonly TranslationItem[],
): value is TranslationPack {
  const p = value as TranslationPack;
  if (
    !p ||
    p.version !== 1 ||
    p.sourceLanguage !== "en" ||
    p.targetLanguage !== "am" ||
    !/^[a-f0-9]{64}$/.test(p.sourceRevision) ||
    !["prepared", "ai-draft"].includes(p.provenance) ||
    !Array.isArray(p.items) ||
    p.items.length !== items.length
  )
    return false;
  const ids = new Set<string>();
  return p.items.every((item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      item.text.length > 12000 ||
      ids.has(item.id) ||
      !items.some((source) => source.id === item.id)
    )
      return false;
    ids.add(item.id);
    return true;
  });
}
/** Keep preformatted code and fenced code out of translation batches. */
export function lessonItems(id: string, text: string): TranslationItem[] {
  const blocks = text.split(/(```[\s\S]*?```)/g).filter((t) => t.trim());
  const items: TranslationItem[] = [];
  for (const block of blocks) {
    if (block.startsWith("```")) {
      items.push({ id: `${id}:${items.length}`, text: block, kind: "code" });
      continue;
    }
    let rest = block.trim();
    while (rest) {
      let end = Math.min(3000, rest.length);
      if (end < rest.length) {
        const stop = rest.lastIndexOf(" ", end);
        if (stop > 0) end = stop;
      }
      items.push({
        id: `${id}:${items.length}`,
        text: rest.slice(0, end).trim(),
        kind: "text",
      });
      rest = rest.slice(end).trimStart();
    }
  }
  return items;
}

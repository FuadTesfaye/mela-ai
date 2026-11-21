import { z } from "zod";
import type { ExplanationBlock } from "../types";
const refs = z.array(z.string().max(100)).max(4);
const diagram = z
  .object({
    kind: z.literal("diagram"),
    title: z.string().min(1).max(160),
    description: z.string().min(1).max(1600),
    nodes: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/),
            label: z.string().min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    edges: z
      .array(
        z
          .object({
            from: z.string().max(32),
            to: z.string().max(32),
            label: z.string().max(80).optional(),
          })
          .strict(),
      )
      .max(12),
    sourceIds: refs,
  })
  .strict();
export const explanationBlockSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("paragraph"),
      text: z.string().min(1).max(3000),
      sourceIds: refs,
    })
    .strict(),
  z
    .object({
      kind: z.literal("example"),
      text: z.string().min(1).max(3000),
      sourceIds: refs,
    })
    .strict(),
  z
    .object({
      kind: z.literal("steps"),
      items: z.array(z.string().min(1).max(600)).min(1).max(8),
      sourceIds: refs,
    })
    .strict(),
  diagram,
]);
export const generatedAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(6000),
  // Empty when the lesson doesn't cover the question and a general answer is given.
  sourceIds: z.array(z.string().max(160)).max(12),
  blocks: z.array(explanationBlockSchema).max(6).optional(),
});
export const explanationJsonSchema = z.toJSONSchema(generatedAnswerSchema);
export function validateBlocks(
  blocks: ExplanationBlock[] | undefined,
  selected: Set<string>,
) {
  for (const block of blocks || []) {
    if (block.sourceIds.some((id) => !selected.has(id)))
      throw new Error("Explanation references an unavailable source.");
    if (block.kind === "diagram") {
      const ids = new Set(block.nodes.map((n) => n.id));
      if (
        ids.size !== block.nodes.length ||
        block.edges.some((e) => !ids.has(e.from) || !ids.has(e.to))
      )
        throw new Error("Invalid diagram connections.");
    }
  }
}
export function plainExplanation(
  summary: string,
  blocks: ExplanationBlock[] = [],
) {
  return [
    summary,
    ...blocks.map((b) =>
      b.kind === "diagram"
        ? `${b.title}: ${b.description}\n${b.nodes.map((n) => n.label).join("; ")}\n${b.edges.map((e) => `${b.nodes.find((n) => n.id === e.from)!.label} → ${b.nodes.find((n) => n.id === e.to)!.label}${e.label ? ": " + e.label : ""}`).join("\n")}`
        : b.kind === "steps"
          ? b.items.map((v, i) => `${i + 1}. ${v}`).join("\n")
          : b.kind === "example"
            ? "Illustrative example: " + b.text
            : b.text,
    ),
  ]
    .join("\n\n")
    .slice(0, 18000);
}

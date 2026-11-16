/** Prepare an ignored bilingual video pack before building the demo image. */
import { readFile, writeFile } from "node:fs/promises";
import { transcriptSchema } from "../lib/media/transcript";
import { transcriptRevision } from "../lib/media/video-context";
import { translateItems } from "../lib/localization/service";
import lesson from "../data/lesson-media.json";
async function main() {
  const sourcePath = `public/transcripts/${lesson.videoId}.json`;
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(sourcePath, "utf8"));
  } catch {
    throw new Error(
      "Prepare the selected English source captions first: run scripts/prepare-video.py using the optional video environment.",
    );
  }
  const source = transcriptSchema.parse(raw),
    revision = transcriptRevision(lesson.videoUrl, source.cues);
  const targetPath = `public/transcripts/${lesson.videoId}.am.json`;
  try {
    const existing = JSON.parse(await readFile(targetPath, "utf8"));
    if (
      existing.revision === revision &&
      existing.entries?.length === source.cues.length &&
      existing.entries.every(
        (entry: { sourceText: string; targetText: string }, i: number) =>
          entry.sourceText === source.cues[i].text && !!entry.targetText,
      )
    ) {
      console.log("Prepared Amharic caption pack already matches the source.");
      return;
    }
  } catch {}
  const entries: { sourceText: string; targetText: string }[] = [];
  let index = 0;
  while (index < source.cues.length) {
    const batch: { id: string; text: string }[] = [];
    let size = 0;
    while (
      index < source.cues.length &&
      batch.length < 10 &&
      size + source.cues[index].text.length <= 3000
    ) {
      const cue = source.cues[index];
      batch.push({ id: "cue-" + index, text: cue.text });
      size += cue.text.length;
      index++;
    }
    if (!batch.length)
      throw new Error("A source cue exceeds the translation batch limit.");
    const result = await translateItems({
      sourceLanguage: "en",
      targetLanguage: "am",
      cloudConsent: true,
      items: batch,
    });
    for (const item of batch)
      entries.push({
        sourceText: item.text,
        targetText: result.items.find((t) => t.id === item.id)!.text,
      });
    console.log(
      `Prepared ${index}/${source.cues.length} Amharic draft captions.`,
    );
  }
  await writeFile(
    targetPath,
    JSON.stringify(
      {
        version: 1,
        glossaryVersion: "am-1",
        status: "ai-draft",
        videoUrl: lesson.videoUrl,
        revision,
        entries,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Bilingual caption pack prepared. Fluent review is still pending.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Translation preparation failed.",
  );
  process.exitCode = 1;
});

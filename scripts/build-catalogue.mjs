import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseHTML } from "linkedom";
const definitions = [
  [
    "va-foundations",
    "Virtual Assistant Foundations",
    "concept-with-navigation.html",
  ],
  [
    "offline-first-localized-ai",
    "Offline-First & Localized AI",
    "offline-first-localized-ai.html",
  ],
  [
    "programming-for-beginners",
    "Programming for Beginners",
    "programming-for-beginners.html",
  ],
];
const courses = [];
const prepared = JSON.parse(
  await readFile("data/localization/am-prepared.json", "utf8"),
);
const normal = (text) => text.normalize("NFC").replace(/\s+/g, " ").trim();
await mkdir("public/courses", { recursive: true });
for (const [id, title, file] of definitions) {
  const { document } = parseHTML(
    await readFile("public/savanna/pages/" + file, "utf8"),
  );
  const root = document.querySelector("main");
  const sections = [];
  const approved = root.querySelectorAll("[data-mela-section]");
  const clean = (node) => {
    const copy = node.cloneNode(true);
    copy
      .querySelectorAll(
        "form,input,textarea,select,script,style,nav,[data-private],[hidden]",
      )
      .forEach((n) => n.remove());
    return copy.textContent.trim();
  };
  if (approved.length)
    for (const node of approved) {
      const anchor = node.id;
      if (!anchor) continue;
      sections.push({
        id: (id + "-" + anchor).slice(0, 100),
        title: node.querySelector("h2,h3,h4")?.textContent.trim() || title,
        content: clean(node.querySelector("[data-mela-content]") || node).slice(
          0,
          6000,
        ),
        language: "en",
        courseId: id,
        url: "/savanna/pages/" + file + "#" + anchor,
      });
    }
  else {
    const region = root.querySelector(".formatted-content .savanna-styles");
    if (!region) throw new Error("Missing approved lesson region: " + file);
    let heading = title,
      anchor = "curriculum_navigation_content",
      content = "",
      index = 0;
    const flush = () => {
      if (content.trim())
        sections.push({
          id: id + "-" + index++,
          title: heading,
          content: content.trim().slice(0, 6000),
          language: "en",
          courseId: id,
          url: "/savanna/pages/" + file + "#" + anchor,
        });
      content = "";
    };
    for (const node of region.childNodes) {
      if (node.nodeType === 1 && /^H[2-4]$/.test(node.tagName)) {
        flush();
        heading = node.textContent.trim();
        anchor =
          node.querySelector("[id]")?.id ||
          node.id ||
          "curriculum_navigation_content";
      } else if (node.nodeType === 3) content += " " + node.textContent;
      else if (node.nodeType === 1) {
        const text = clean(node);
        if (content.length + text.length > 5500) flush();
        content += "\n" + text;
      }
    }
    flush();
  }
  if (!sections.length) throw new Error("Empty course " + id);
  const resources = [];
  const entries = prepared.entries.filter((entry) =>
    sections.some(
      (section) =>
        normal(section.content).includes(normal(entry.sourceText)) ||
        normal(section.title) === normal(entry.sourceText),
    ),
  );
  const languagePack = {
    version: 1,
    status: "ai-draft",
    entries,
    glossary: prepared.glossary,
  };
  const localeBytes = JSON.stringify(languagePack);
  await writeFile("public/courses/" + id + ".am.json", localeBytes);
  resources.push({
    url: "/courses/" + id + ".am.json",
    bytes: Buffer.byteLength(localeBytes),
    sha256: createHash("sha256").update(localeBytes).digest("hex"),
  });
  for (const [url, path] of [
    ["/transcripts/9hE5-98ZeCg.json", "public/transcripts/9hE5-98ZeCg.json"],
    [
      "/transcripts/9hE5-98ZeCg.am.json",
      "public/transcripts/9hE5-98ZeCg.am.json",
    ],
    [
      "/fonts/noto-sans-ethiopic.woff2",
      "public/fonts/noto-sans-ethiopic.woff2",
    ],
  ]) {
    const bytes = await readFile(path);
    resources.push({
      url,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const practice =
    id === "offline-first-localized-ai"
      ? [
          {
            question:
              "Which approach combines local core features with online updates and bigger models?",
            options: ["Hybrid", "Cloud only", "No offline features"],
            correct: 0,
            rationale:
              "The lesson describes hybrid as local first, with cloud capabilities when online.",
            sourceId:
              sections.find((s) => s.content.includes("Hybrid"))?.id ||
              sections[0].id,
          },
        ]
      : [];
  const revision = createHash("sha256")
    .update(JSON.stringify({ sections, resources, practice }))
    .digest("hex");
  courses.push({
    version: 1,
    id,
    title,
    revision,
    source: "/savanna/pages/" + file,
    languages: entries.length ? ["en", "am"] : ["en"],
    sections,
    resources,
    practice,
    notice:
      "Public lesson text. Streaming videos are online-only. Translations remain AI drafts until reviewed.",
  });
}
await mkdir("public/courses", { recursive: true });
await writeFile(
  "data/course-catalogue.json",
  JSON.stringify(courses, null, 2) + "\n",
);
for (const c of courses)
  await writeFile("public/courses/" + c.id + ".json", JSON.stringify(c));
const old = JSON.parse(await readFile("data/content.json", "utf8"));
await writeFile(
  "public/content.json",
  JSON.stringify([
    ...courses.flatMap((c) => c.sections),
    ...old.filter((s) => !courses.some((c) => c.id === s.courseId)),
  ]),
);
await writeFile(
  "public/courses/index.json",
  JSON.stringify(
    courses.map(({ sections, resources, practice, ...c }) => ({
      ...c,
      bytes:
        Buffer.byteLength(JSON.stringify(courses.find((x) => x.id === c.id))) +
        resources.reduce((n, r) => n + r.bytes, 0),
    })),
  ),
);
console.log("Prepared " + courses.length + " approved public courses.");

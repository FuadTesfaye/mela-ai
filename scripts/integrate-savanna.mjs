await import("./build-programming.mjs");
await import("./build-training.mjs");
import { readFile, writeFile } from "node:fs/promises";
const pages = [
  "homepage-v1-paced.html",
  "homepage-v1-self-paced.html",
  "concept-with-navigation.html",
  "offline-first-localized-ai.html",
  "programming-for-beginners.html",
];
for (const page of pages) {
  const path = "public/savanna/pages/" + page;
  let html = await readFile(path, "utf8");
  if (!html.includes("mela-integration.css"))
    html = html.replace(
      "</head>",
      '<link rel="stylesheet" href="/savanna/mela-integration.css">\n</head>',
    );
  if (!html.includes("/savanna-integration.js"))
    html = html.replace(
      "</body>",
      '<script src="/db-assistant.js" defer></script>\n<script src="/savanna-integration.js" defer></script>\n</body>',
    );
  await writeFile(path, html);
}

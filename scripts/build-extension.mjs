import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
await mkdir("extension/dist/icons", { recursive: true });
await mkdir("extension/dist/avatar", { recursive: true });
await mkdir("public/downloads", { recursive: true });
await build({
  entryPoints: ["extension/content.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  outfile: "extension/dist/content.js",
});
await build({
  entryPoints: ["extension/background.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  outfile: "extension/dist/background.js",
});
await build({
  entryPoints: ["extension/autoload.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  outfile: "extension/dist/autoload.js",
});
await build({
  entryPoints: ["extension/popup.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  outfile: "extension/dist/popup.js",
});
await build({
  entryPoints: ["extension/options.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  outfile: "extension/dist/options.js",
});
for (const file of ["manifest.json", "options.html", "options.css", "popup.html"])
  await copyFile("extension/" + file, "extension/dist/" + file);
await copyFile(
  "public/icons/mela-192.png",
  "extension/dist/icons/mela-192.png",
);
// Same visual-teacher runtime and fingerspelling module the course player uses.
// Run `npm run widget:build` first so these public bundles are current.
for (const [from, to] of [
  ["public/avatar/teacher-3d.js", "avatar/teacher-3d.js"],
  ["public/avatar/storyboard.json", "avatar/storyboard.json"],
  ["public/spelling.js", "spelling.js"],
])
  await copyFile(from, "extension/dist/" + to);
// Prepared captions for demo/lesson videos (teacher + Explain on YouTube).
import { readdir } from "node:fs/promises";
await mkdir("extension/dist/transcripts", { recursive: true });
const transcripts = (await readdir("public/transcripts")).filter((f) =>
  f.endsWith(".json"),
);
for (const file of transcripts)
  await copyFile(
    "public/transcripts/" + file,
    "extension/dist/transcripts/" + file,
  );
console.log("Load extension/dist as an unpacked extension in Chromium.");

import { zipFiles } from "./zip.mjs";
const files = [];
for (const name of [
  "manifest.json",
  "background.js",
  "content.js",
  "autoload.js",
  "popup.js",
  "popup.html",
  "options.js",
  "options.html",
  "options.css",
  "icons/mela-192.png",
  "avatar/teacher-3d.js",
  "avatar/storyboard.json",
  "spelling.js",
  ...transcripts.map((f) => "transcripts/" + f),
])
  files.push({ name, data: await readFile("extension/dist/" + name) });
const zip = zipFiles(files);
await writeFile("extension/mela-extension.zip", zip);
// Public download served by the web app at /downloads/mela-extension.zip
await writeFile("public/downloads/mela-extension.zip", zip);
console.log("Packaged extension/mela-extension.zip");

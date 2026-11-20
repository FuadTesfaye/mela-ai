import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
await mkdir("extension/dist/icons", { recursive: true });
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
  entryPoints: ["extension/options.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "chrome120",
  outfile: "extension/dist/options.js",
});
for (const file of ["manifest.json", "options.html", "options.css"])
  await copyFile("extension/" + file, "extension/dist/" + file);
await copyFile(
  "public/icons/mela-192.png",
  "extension/dist/icons/mela-192.png",
);
console.log("Load extension/dist as an unpacked extension in Chromium.");

import { zipFiles } from "./zip.mjs";
const files = [];
for (const name of [
  "manifest.json",
  "background.js",
  "content.js",
  "options.js",
  "options.html",
  "options.css",
  "icons/mela-192.png",
])
  files.push({ name, data: await readFile("extension/dist/" + name) });
await writeFile("extension/mela-extension.zip", zipFiles(files));
console.log("Packaged extension/mela-extension.zip");

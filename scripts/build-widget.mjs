import { build } from "esbuild";
import { stat, mkdir, copyFile, readFile } from "node:fs/promises";
// Only explicitly namespaced private fields are mangled; host APIs stay stable.
import { gzipSync } from "node:zlib";
await mkdir("public", { recursive: true });
await build({
  entryPoints: ["module/db-assistant.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  outfile: "public/db-assistant.js",
});
const { size } = await stat("public/db-assistant.js");
if (size > 500000) throw new Error(`Widget exceeds 500 KB: ${size}`);
console.log(`Widget: ${(size / 1024).toFixed(1)} KB (uncompressed)`);

await build({
  entryPoints: ["module/avatar/avatar-view.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "esm",
  outfile: "public/avatar-view.js",
});

await copyFile("openapi.yaml", "public/openapi.yaml");

await build({
  entryPoints: ["module/savanna/integration.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  outfile: "public/savanna-integration.js",
});
await import("./integrate-savanna.mjs");
await import("./build-catalogue.mjs");

await build({
  entryPoints: ["module/media/course-media.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  outfile: "public/course-media.js",
});

// The core SDK defers DOM registration, so ESM/React imports remain SSR-safe.
await mkdir("packages/sdk/dist", { recursive: true });
await mkdir("public/sdk", { recursive: true });
await build({
  entryPoints: ["packages/sdk/src/index.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "esm",
  outfile: "packages/sdk/dist/index.js",
});
await build({
  entryPoints: ["packages/sdk/src/react.tsx"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "esm",
  external: ["react", "react/jsx-runtime"],
  plugins: [
    {
      name: "sdk-core-external",
      setup(build) {
        build.onResolve({ filter: /^\.\/index$/ }, () => ({
          path: "./index.js",
          external: true,
        }));
      },
    },
  ],
  outfile: "packages/sdk/dist/react.js",
});
await build({
  entryPoints: ["packages/sdk/src/browser.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "MelaAI",
  outfile: "public/mela-sdk.js",
});
for (const name of ["index", "react"]) {
  await copyFile(
    `packages/sdk/types/${name}.d.ts`,
    `packages/sdk/dist/${name}.d.ts`,
  );
  await copyFile(`packages/sdk/dist/${name}.js`, `public/sdk/${name}.js`);
}

// Kept outside the SDK: fetched only after the visual panel is opened.
await mkdir("public/avatar", { recursive: true });
await build({
  entryPoints: ["module/teacher/renderer-3d.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "MelaTeacher3D",
  outfile: "public/avatar/teacher-3d.js",
});
const runtime = await readFile("public/avatar/teacher-3d.js");
if (gzipSync(runtime).length > 250000)
  throw new Error("3D runtime exceeds its 250 KB gzip budget.");

await copyFile("data/visual-teacher.json", "public/avatar/storyboard.json");
// Optional language/reader and fingerspelling features are independent classic scripts.
await build({
  entryPoints: ["module/localization/entry.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "MelaLocale",
  outfile: "public/locale.js",
});
await build({
  entryPoints: ["module/media/fingerspelling.ts"],
  bundle: true,
  charset: "utf8",
  mangleProps: /^_mela/,
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "MelaSpelling",
  outfile: "public/spelling.js",
});
await build({
  entryPoints: ["module/voice/input.ts"],
  bundle: true,
  charset: "utf8",
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "MelaVoice",
  outfile: "public/voice.js",
});
await mkdir("public/i18n", { recursive: true });
await copyFile("data/localization/am-prepared.json", "public/i18n/am.json");
const sdkSize = (await stat("public/mela-sdk.js")).size;
if (sdkSize > 100000) throw new Error(`Initial SDK exceeds 100 KB: ${sdkSize}`);
await build({
  entryPoints: ["module/offline/app.ts"],
  bundle: true,
  minify: true,
  target: "es2020",
  format: "iife",
  outfile: "public/offline-library.js",
});
await build({
  entryPoints: ["module/actions/entry.ts"],
  bundle: true,
  minify: true,
  target: "es2020",
  format: "iife",
  globalName: "MelaActions",
  outfile: "public/actions.js",
});

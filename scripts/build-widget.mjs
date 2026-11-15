import { build } from "esbuild";
import { stat, mkdir, copyFile } from "node:fs/promises";
await mkdir("public", { recursive: true });
await build({
  entryPoints: ["module/db-assistant.ts"],
  bundle: true,
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
  minify: true,
  target: "es2020",
  format: "esm",
  outfile: "public/avatar-view.js",
});

await copyFile("openapi.yaml", "public/openapi.yaml");
await copyFile("data/content.json", "public/content.json");

await build({
  entryPoints: ["module/savanna/integration.ts"],
  bundle: true,
  minify: true,
  target: "es2020",
  format: "iife",
  outfile: "public/savanna-integration.js",
});
await import("./integrate-savanna.mjs");

await build({
  entryPoints: ["module/media/course-media.ts"],
  bundle: true,
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
  minify: true,
  target: "es2020",
  format: "esm",
  outfile: "packages/sdk/dist/index.js",
});
await build({
  entryPoints: ["packages/sdk/src/react.tsx"],
  bundle: true,
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

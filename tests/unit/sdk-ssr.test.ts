import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MelaCompanion } from "../../packages/sdk/src/react";
import { mount } from "../../packages/sdk/src/index";
test("React SDK imports and renders during SSR without DOM globals", () => {
  assert.equal(
    renderToString(
      createElement(MelaCompanion, {
        api: "https://mela.example/api",
        className: "companion",
      }),
    ),
    '<div class="companion"></div>',
  );
});
test("core SDK gives a controlled browser-only error if mounted during SSR", async () => {
  await assert.rejects(
    mount({ container: "#companion", api: "https://mela.example/api" }),
    /browser/,
  );
});

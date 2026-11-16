import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../app/api/v1/speech/route";
const audio = Buffer.from("1a45dfa300010203040506070809", "hex").toString(
  "base64",
);
const request = (data: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/v1/speech", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
test("speech relay validates consent and recording format before contacting a provider", async () => {
  assert.equal(
    (await POST(request({ language: "am", mimeType: "audio/webm", audio })))
      .status,
    400,
  );
  assert.equal(
    (
      await POST(
        request({
          language: "am",
          mimeType: "audio/webm",
          audio: Buffer.from("plain text data").toString("base64"),
          consent: true,
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request(
          { language: "am", mimeType: "audio/webm", audio, consent: true },
          "https://other.test",
        ),
      )
    ).status,
    403,
  );
});
test("speech relay transcribes protected audio through server-side inline data without storing it", async () => {
  const before = { key: process.env.GEMINI_API_KEY, fetch: globalThis.fetch };
  process.env.GEMINI_API_KEY = "unit-test-not-a-key";
  let sent = false;
  try {
    globalThis.fetch = async (_url, init) => {
      const data = JSON.parse(String(init?.body));
      assert.equal(data.contents[0].parts[0].inlineData.data, audio);
      assert.equal(data.contents[0].parts[0].inlineData.mimeType, "audio/webm");
      assert.match(data.contents[0].parts[1].text, /Amharic/);
      sent = true;
      return Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ text: JSON.stringify({ text: "ይህን ትምህርት አብራራልኝ" }) }],
            },
          },
        ],
      });
    };
    const response = await POST(
      request({ language: "am", mimeType: "audio/webm", audio, consent: true }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "ይህን ትምህርት አብራራልኝ");
    assert.equal(sent, true);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally {
    globalThis.fetch = before.fetch;
    if (before.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = before.key;
  }
});

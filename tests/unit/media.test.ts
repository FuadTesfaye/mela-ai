import { test } from "node:test";
import assert from "node:assert/strict";
import { youtubeId, youtubeUrl } from "../../lib/media/youtube";
import { transcriptSchema, transcribeVideo } from "../../lib/media/transcript";
import { POST } from "../../app/api/v1/transcriptions/route";
import { GET } from "../../app/api/v1/lessons/[id]/media/route";
test("YouTube normalization accepts real embed/watch/share URLs and rejects arbitrary hosts", () => {
  assert.equal(youtubeId("https://youtu.be/9hE5-98ZeCg?t=12"), "9hE5-98ZeCg");
  assert.equal(
    youtubeUrl("https://www.youtube.com/embed/9hE5-98ZeCg"),
    "https://www.youtube.com/watch?v=9hE5-98ZeCg",
  );
  assert.throws(() =>
    youtubeId("https://youtube.com.attacker.example/watch?v=9hE5-98ZeCg"),
  );
  assert.throws(() => youtubeId("javascript:alert(1)"));
});
test("transcripts require English, ordered timestamps and real text", () => {
  assert.equal(
    transcriptSchema.safeParse({
      title: "Lesson",
      language: "en",
      cues: [{ start: 0, end: 2, text: "A lesson." }],
    }).success,
    true,
  );
  assert.equal(
    transcriptSchema.safeParse({
      title: "Lesson",
      language: "en",
      cues: [{ start: 5, end: 2, text: "Invalid" }],
    }).success,
    false,
  );
  assert.equal(
    transcriptSchema.safeParse({ title: "Lesson", language: "en", cues: [] })
      .success,
    false,
  );
});
test("transcription requires explicit consent before Gemini can be called", async () => {
  const request = new Request("http://localhost:3000/api/v1/transcriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      videoUrl: "https://youtu.be/9hE5-98ZeCg",
      consent: false,
    }),
  });
  assert.equal((await POST(request)).status, 400);
});
test("signing metadata remains unavailable without validation bound to a lesson video", async () => {
  const previous = process.env.SIGN_LANGUAGE_VALIDATED;
  process.env.SIGN_LANGUAGE_VALIDATED = "false";
  try {
    const response = await GET(
      new Request("http://localhost:3000/api/v1/lessons/va-future/media"),
      { params: Promise.resolve({ id: "va-future" }) },
    );
    assert.equal((await response.json()).signLanguage, null);
  } finally {
    if (previous === undefined) delete process.env.SIGN_LANGUAGE_VALIDATED;
    else process.env.SIGN_LANGUAGE_VALIDATED = previous;
  }
});
test("Gemini video transcription sends the actual YouTube media and caches a validated response", async () => {
  const previous = { key: process.env.GEMINI_API_KEY, fetch: globalThis.fetch };
  process.env.GEMINI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(
      body.contents[0].parts[0].fileData.fileUri,
      "https://www.youtube.com/watch?v=9hE5-98ZeCg",
    );
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "Video lesson",
                  language: "en",
                  cues: [
                    {
                      start: 0,
                      end: 4,
                      text: "A real test transcript from the mocked audio provider.",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  try {
    const first = await transcribeVideo("https://youtu.be/9hE5-98ZeCg");
    const second = await transcribeVideo(
      "https://www.youtube.com/watch?v=9hE5-98ZeCg",
    );
    assert.equal(first.language, "en");
    assert.equal(second.cues[0].start, 0);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.key;
  }
});
test("a reviewed signing clip is advertised only with an explicit video binding", async () => {
  const keys = [
    "SIGN_LANGUAGE_VIDEO_URL",
    "SIGN_LANGUAGE_VALIDATED",
    "SIGN_LANGUAGE_REVIEWER",
    "SIGN_LANGUAGE_LESSON_VIDEO_ID",
  ];
  const saved = keys.map((key) => process.env[key]);
  try {
    process.env.SIGN_LANGUAGE_VIDEO_URL = "/signing/reviewed-example.mp4";
    process.env.SIGN_LANGUAGE_VALIDATED = "true";
    process.env.SIGN_LANGUAGE_REVIEWER = "Fluent signer review reference";
    delete process.env.SIGN_LANGUAGE_LESSON_VIDEO_ID;
    const params = { params: Promise.resolve({ id: "va-future" }) };
    const request = () =>
      new Request("http://localhost:3000/api/v1/lessons/va-future/media");
    assert.equal(
      (await (await GET(request(), params)).json()).signLanguage,
      null,
    );
    process.env.SIGN_LANGUAGE_LESSON_VIDEO_ID = "9hE5-98ZeCg";
    const data = await (await GET(request(), params)).json();
    assert.equal(data.signLanguage.videoId, "9hE5-98ZeCg");
    assert.equal(data.signLanguage.url, "/signing/reviewed-example.mp4");
  } finally {
    keys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
    });
  }
});

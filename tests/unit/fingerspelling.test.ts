import { test } from "node:test";
import assert from "node:assert/strict";
import { handshapeFor, spellingAt } from "../../module/media/fingerspelling";
import { validTranscript } from "../../module/media/transcript-client";
test("English spelling is a pure function of source time, including seeking and non-speech", () => {
  const cue = { start: 2, end: 8, text: "Hi Jo" };
  assert.equal(spellingAt(cue, 2)?.letter, "H");
  assert.equal(spellingAt(cue, 3)?.letter, "I");
  assert.equal(spellingAt(cue, 5)?.letter, "J");
  assert.equal(spellingAt(cue, 6)?.letter, "O");
  assert.equal(spellingAt(cue, 2)?.word, "Hi");
  assert.equal(spellingAt(cue, 5)?.word, "Jo");
  assert.equal(spellingAt(cue, 1), undefined);
  assert.equal(spellingAt(cue, 8), undefined);
  assert.equal(spellingAt({ ...cue, text: "[Music]" }, 3), undefined);
  assert.equal(spellingAt({ ...cue, text: "123" }, 3), undefined);
});
test("manual-alphabet renderer covers A–Z and moving J/Z without accepting unsupported symbols", () => {
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const shape = handshapeFor(letter, 0.4);
    assert.ok(shape);
    assert.equal(shape.fingers.length, 4);
    assert.ok(shape.offset.every(Number.isFinite));
  }
  assert.notDeepEqual(
    handshapeFor("J", 0)?.offset,
    handshapeFor("J", 0.7)?.offset,
  );
  assert.notDeepEqual(
    handshapeFor("Z", 0)?.offset,
    handshapeFor("Z", 0.7)?.offset,
  );
  assert.equal(handshapeFor("?"), undefined);
});
test("prepared captions must match the exact video and chronological bounded timings", () => {
  const url = "https://www.youtube.com/watch?v=9hE5-98ZeCg";
  const value = {
    language: "en",
    generated: false,
    videoUrl: url,
    cues: [
      { start: 0, end: 3, text: "Source caption" },
      { start: 3, end: 5, text: "Next" },
    ],
  };
  assert.equal(validTranscript(value, url), true);
  assert.equal(
    validTranscript(
      { ...value, videoUrl: "https://youtu.be/bJzb-RuUcMU" },
      url,
    ),
    false,
  );
  assert.equal(
    validTranscript({ ...value, cues: [value.cues[1], value.cues[0]] }, url),
    false,
  );
  assert.equal(
    validTranscript(
      { ...value, cues: [{ start: 0, end: 14401, text: "Too long" }] },
      url,
    ),
    false,
  );
});

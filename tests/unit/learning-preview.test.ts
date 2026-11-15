import { test } from "node:test";
import assert from "node:assert/strict";
import { cueAt, gestureFor } from "../../module/media/learning-preview";
test("caption timeline uses exact cue boundaries and gaps when seeking", () => {
  const cues = [
    { start: 1, end: 3, text: "Hello" },
    { start: 5, end: 7, text: "Compare local and cloud" },
  ];
  assert.equal(cueAt(cues, 0), undefined);
  assert.equal(cueAt(cues, 1), cues[0]);
  assert.equal(cueAt(cues, 3), undefined);
  assert.equal(cueAt(cues, 5), cues[1]);
  assert.equal(cueAt(cues, 7), undefined);
  assert.equal(cueAt([], 12), undefined);
  assert.equal(cueAt(cues, 2), cues[0]);
});
test("illustrative gesture presets respond to text and rest during silence", () => {
  assert.equal(gestureFor(""), "rest");
  assert.equal(gestureFor("Hello and welcome"), "wave");
  assert.equal(gestureFor("First, take three steps"), "count");
  assert.equal(gestureFor("Compare local and cloud"), "compare");
  assert.equal(gestureFor("Connect these together"), "connect");
  assert.equal(gestureFor("Look at the code"), "point");
  assert.equal(gestureFor("A variable stores a value"), "explain");
});

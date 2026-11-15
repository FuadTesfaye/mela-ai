import { test } from "node:test";
import assert from "node:assert/strict";
import {
  videoEvidence,
  transcriptRevision,
} from "../../lib/media/video-context";
import type { LearningContext } from "../../lib/types";
const context: LearningContext = {
  pageType: "lesson",
  courseId: "programming-for-beginners",
  sections: [],
  video: {
    videoId: "bJzb-RuUcMU",
    url: "https://www.youtube.com/watch?v=bJzb-RuUcMU",
    title: "Programming",
    currentTime: 120,
    duration: 270,
  },
};
const cues = [
  { start: 0, end: 10, text: "Opening words." },
  { start: 100, end: 110, text: "Learn one idea." },
  { start: 120, end: 130, text: "Practice that idea." },
  { start: 240, end: 250, text: "Closing words." },
];
test("moment evidence is frozen around the question timestamp with real source links", () => {
  const frozen = videoEvidence(context, cues, "moment");
  assert.ok(frozen.sections.some((s) => s.content.includes("Practice")));
  assert.ok(
    !frozen.sections.some(
      (s) => s.content.includes("Opening") || s.content.includes("Closing"),
    ),
  );
  context.video!.currentTime = 200;
  assert.equal(frozen.video!.currentTime, 120);
  assert.match(frozen.sections[0].url, /t=100/);
  context.video!.currentTime = 120;
});
test("whole video and lesson scopes stay separate", () => {
  assert.match(
    videoEvidence(context, cues, "wholeVideo").sections[0].content,
    /Opening/,
  );
  assert.equal(videoEvidence(context, cues, "lesson").sections.length, 0);
  assert.notEqual(
    transcriptRevision(context.video!.url, cues),
    transcriptRevision(context.video!.url, cues.slice(1)),
  );
});

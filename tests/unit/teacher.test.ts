import { test } from "node:test";
import assert from "node:assert/strict";
import { length, solveArm, teacherPose } from "../../module/teacher/pose";
import type {
  TeacherFrame,
  TeacherGesture,
  Vec3,
} from "../../module/teacher/types";
const distance = (a: Vec3, b: Vec3) =>
  length([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
test("arm IK preserves segment lengths and clamps unreachable or degenerate targets", () => {
  for (const side of [-1, 1] as const)
    for (const target of [
      [0, 0, 0],
      [100, 100, 100],
      [0, 0.00001, 0],
      [-0.5, 1, 0.4],
    ] as Vec3[]) {
      const arm = solveArm([0, 0, 0], target, side);
      assert.ok(Math.abs(distance(arm.shoulder, arm.elbow) - 0.45) < 1e-8);
      assert.ok(Math.abs(distance(arm.elbow, arm.wrist) - 0.43) < 1e-8);
      assert.ok([...arm.wrist, ...arm.elbow].every(Number.isFinite));
    }
});
test("all gesture frames have bounded readable reaches and deterministic seeking", () => {
  for (const gesture of [
    "welcome",
    "point",
    "compare",
    "connect",
    "count",
    "emphasize",
    "rest",
  ] as TeacherGesture[])
    for (const phase of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      const frame: TeacherFrame = {
        seconds: phase * 8,
        phase,
        gesture,
        playing: true,
        visible: true,
        motion: true,
        camera: "front",
      };
      const a = teacherPose(frame);
      assert.deepEqual(a, teacherPose(frame));
      for (const arm of [a.left, a.right]) {
        assert.ok(Math.abs(arm.wrist[0]) < 0.8);
        assert.ok(arm.wrist[1] > 0.7 && arm.wrist[1] < 2);
        assert.ok(Math.abs(distance(arm.shoulder, arm.elbow) - 0.45) < 1e-8);
      }
      assert.ok(
        [...a.leftCurl, ...a.rightCurl].every((x) => x >= 0 && x <= 1.5),
      );
    }
});
import storyboard from "../../data/visual-teacher.json";
import {
  gesturePhase,
  segmentAt,
  validStoryboard,
} from "../../module/teacher/storyboard";
test("authored lesson segments validate and never attach to another video", () => {
  assert.equal(validStoryboard(storyboard), true);
  if (!validStoryboard(storyboard)) return;
  assert.equal(segmentAt(storyboard, "9hE5-98ZeCg", 105)?.id, "memory");
  assert.equal(segmentAt(storyboard, "bJzb-RuUcMU", 105), undefined);
  assert.equal(segmentAt(undefined, undefined, 0), undefined);
  assert.equal(
    validStoryboard({
      ...storyboard,
      segments: [{ ...storyboard.segments[0], gesture: "run arbitrary code" }],
    }),
    false,
  );
  assert.equal(
    validStoryboard({
      ...storyboard,
      segments: [storyboard.segments[1], storyboard.segments[0]],
    }),
    false,
  );
});
test("gesture phases have smooth holds and bounded transitions even for short cues", () => {
  for (const duration of [0.05, 0.5, 4, 30]) {
    assert.equal(gesturePhase(0, 0, duration), 0);
    assert.equal(gesturePhase(duration, 0, duration), 1);
    const values = Array.from({ length: 21 }, (_, i) =>
      gesturePhase((duration * i) / 20, 0, duration),
    );
    assert.ok(
      values.every(
        (v, i) => v >= 0 && v <= 1 && (i === 0 || v >= values[i - 1]),
      ),
    );
  }
});

import { captionMotion } from "../../module/media/caption-motion";
test("transcript text selects gestures, cue timing controls phase, and silence rests both hands", () => {
  const cues = [
    { start: 2, end: 4, text: "Look at the screen" },
    { start: 5, end: 7, text: "Compare different inputs" },
    { start: 8, end: 10, text: "Connect them together" },
  ];
  assert.equal(captionMotion(cues, 3, "count").gesture, "point");
  assert.equal(captionMotion(cues, 6, "point").gesture, "compare");
  assert.equal(captionMotion(cues, 9).gesture, "connect");
  for (const time of [0, 4, 7.5, 10, 20])
    assert.equal(captionMotion(cues, time, "welcome").gesture, "rest");
  assert.equal(captionMotion(cues, 2).phase, 0);
  assert.deepEqual(captionMotion(cues, 3), captionMotion(cues, 3));
  assert.notEqual(captionMotion(cues, 2.4).phase, captionMotion(cues, 3).phase);
  // Long captions sign in ~1.4 s beats with varied gestures, never one held pose.
  const long = [{ start: 0, end: 8, text: "Explain this idea" }];
  assert.equal(captionMotion(long, 4).phase, 0);
  assert.ok(captionMotion(long, 4.5).phase > 0);
  const seen = new Set(
    [0.5, 2, 3.4, 4.7, 6, 7.4].map((t) => captionMotion(long, t).gesture),
  );
  assert.ok(seen.size >= 3);
});
test("caption beats visibly move both wrists and articulate fingers, while reduced motion stays still", () => {
  for (const gesture of [
    "point",
    "compare",
    "connect",
    "count",
    "emphasize",
    "welcome",
  ] as TeacherGesture[]) {
    const base: TeacherFrame = {
      seconds: 1,
      beat: 0.8,
      phase: 0.5,
      gesture,
      playing: true,
      visible: true,
      motion: true,
      camera: "front",
    };
    const first = teacherPose(base),
      later = teacherPose({ ...base, seconds: 2, beat: 1.8 });
    assert.ok(
      distance(first.left.wrist, later.left.wrist) > 0.025,
      gesture + " left hand",
    );
    assert.ok(
      distance(first.right.wrist, later.right.wrist) > 0.025,
      gesture + " right hand",
    );
    assert.notDeepEqual(first.leftCurl, later.leftCurl);
    assert.notDeepEqual(first.rightCurl, later.rightCurl);
    assert.deepEqual(
      teacherPose({ ...base, motion: false }),
      teacherPose({ ...base, seconds: 20, beat: 20, motion: false }),
    );
  }
});

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

import type { TeacherFrame, Vec3 } from "./types";
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => add(a, scale(b, -1));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3) => Math.sqrt(dot(a, a));
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
const mix = (a: Vec3, b: Vec3, k: number): Vec3 =>
  add(scale(a, 1 - k), scale(b, k));
const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
/** Analytic two-bone IK with an outward elbow pole and a clamped reach. */
export function solveArm(
  shoulder: Vec3,
  target: Vec3,
  side: -1 | 1,
  upper = 0.45,
  lower = 0.43,
) {
  let delta = sub(target, shoulder);
  if (length(delta) < 0.0001) delta = [side, 0.1, 0.1];
  const distance = Math.max(
    Math.abs(upper - lower) + 0.025,
    Math.min(upper + lower - 0.012, length(delta)),
  );
  const direction = normalize(delta);
  const wrist = add(shoulder, scale(direction, distance));
  const pole: Vec3 = [side, -0.65, -0.2];
  let perpendicular = sub(pole, scale(direction, dot(pole, direction)));
  if (length(perpendicular) < 0.001)
    perpendicular = sub([0, 0, 1], scale(direction, direction[2]));
  const along =
    (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const elbow = add(
    add(shoulder, scale(direction, along)),
    scale(normalize(perpendicular), height),
  );
  return { shoulder, elbow, wrist };
}
export function teacherPose(frame: TeacherFrame) {
  const phase = Math.max(0, Math.min(1, frame.phase));
  const weight =
    frame.gesture === "rest"
      ? 0
      : smooth(phase / 0.18) * smooth((1 - phase) / 0.18);
  const t = frame.motion ? (frame.beat ?? frame.seconds) : 0,
    beat = Math.sin(t * 2.4),
    slow = Math.sin(t * 1.7);
  let left: Vec3 = [-0.43, 0.85, 0.27],
    right: Vec3 = [0.43, 0.85, 0.27];
  let leftRotation: Vec3 = [-0.12, 0, -0.1],
    rightRotation: Vec3 = [-0.12, 0, 0.1];
  let leftCurl = [0.35, 0.25, 0.25, 0.3, 0.35],
    rightCurl = [0.35, 0.25, 0.25, 0.3, 0.35];
  let gaze = 0;
  switch (frame.gesture) {
    case "welcome":
      right = [0.62 + slow * 0.04, 1.83 + beat * 0.06, 0.34];
      left = [-0.55, 1.15 + slow * 0.06, 0.4];
      rightRotation = [0, -0.15, -0.2 + beat * 0.32];
      rightCurl = [0.1, 0.08, 0.08, 0.08, 0.1];
      gaze = 0.1;
      break;
    case "point":
      left = [-0.43, 1.1 + beat * 0.08, 0.42];
      right = [0.59 + slow * 0.05, 1.4 + beat * 0.06, 0.49];
      rightRotation = [0, -0.12, -0.72];
      rightCurl = [0.6, 0.02, 1.35, 1.35, 1.35];
      gaze = 0.18;
      break;
    case "compare":
      left = [-0.63, 1.19 + beat * 0.11, 0.42];
      right = [0.63, 1.19 - beat * 0.11, 0.42];
      leftRotation = [-0.4, 0.1, 0.4];
      rightRotation = [-0.4, -0.1, -0.4];
      leftCurl = rightCurl = [0.15, 0.12, 0.12, 0.12, 0.15];
      gaze = slow * 0.12;
      break;
    case "connect":
      left = [-0.22 - slow * 0.08, 1.23, 0.52];
      right = [0.22 + slow * 0.08, 1.23, 0.52];
      leftRotation = [-0.1, 0.55, -0.2];
      rightRotation = [-0.1, -0.55, 0.2];
      leftCurl = rightCurl = [0.25, 0.25, 0.25, 0.25, 0.3];
      break;
    case "count":
      left = [-0.4, 1.08 + beat * 0.07, 0.4];
      right = [0.4, 1.45 + slow * 0.06, 0.45];
      leftRotation = [-0.65, 0.1, 0.2];
      rightRotation = [0, -0.1, 0];
      rightCurl = [
        0.8,
        ...Array.from({ length: 4 }, (_, i) =>
          i < Math.min(3, Math.floor(phase * 3) + 1) ? 0.02 : 1.35,
        ),
      ];
      gaze = 0.1;
      break;
    case "emphasize":
      left = [-0.47, 1.14 + beat * 0.1, 0.44];
      right = [0.47, 1.14 - beat * 0.1, 0.44];
      leftRotation = [-0.28, 0.15, 0.22];
      rightRotation = [-0.28, -0.15, -0.22];
      leftCurl = rightCurl = [0.2, 0.18, 0.18, 0.18, 0.2];
      break;
  }
  const leftRest: Vec3 = [-0.43, 0.85, 0.27],
    rightRest: Vec3 = [0.43, 0.85, 0.27];
  return {
    left: solveArm([-0.4, 1.53, 0], mix(leftRest, left, weight), -1),
    right: solveArm([0.4, 1.53, 0], mix(rightRest, right, weight), 1),
    leftRotation: scale(leftRotation, weight),
    rightRotation: scale(rightRotation, weight),
    leftCurl: leftCurl.map((v, i) =>
      Math.max(
        0,
        0.25 +
          (v - 0.25 + (frame.motion ? Math.sin(t * 3 + i * 0.4) * 0.07 : 0)) *
            weight,
      ),
    ),
    rightCurl: rightCurl.map((v, i) =>
      Math.max(
        0,
        0.25 +
          (v -
            0.25 +
            (frame.motion ? Math.sin(t * 3 + i * 0.4 + 1) * 0.07 : 0)) *
            weight,
      ),
    ),
    headYaw: gaze * weight,
    headPitch: frame.motion ? Math.sin(t * 1.3) * 0.018 * weight : 0,
    breath: frame.motion ? Math.sin(t * 1.4) * 0.006 : 0,
  };
}

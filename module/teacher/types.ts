export type TeacherGesture =
  | "welcome"
  | "point"
  | "compare"
  | "connect"
  | "count"
  | "emphasize"
  | "rest";
export type TeacherCamera = "front" | "hands";
export type RendererPreference = "auto" | "2d" | "3d";
export type Vec3 = readonly [number, number, number];
export interface TeacherFrame {
  seconds: number;
  phase: number;
  gesture: TeacherGesture;
  playing: boolean;
  visible: boolean;
  motion: boolean;
  camera: TeacherCamera;
}
export interface TeacherRenderer {
  update(frame: TeacherFrame): void;
  resize(): void;
  dispose(): void;
  stats(): {
    frames: number;
    handsInFrame: boolean;
    calls: number;
    fpsTarget: number;
    triangles: number;
    geometries: number;
    pixelRatio: number;
    quality: string;
    disposed: boolean;
  };
}
export interface TeacherFactory {
  mount(
    host: HTMLElement,
    options: { onFailure: (message: string) => void },
  ): TeacherRenderer;
}

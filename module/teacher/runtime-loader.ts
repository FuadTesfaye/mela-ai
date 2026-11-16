import { loadFeature } from "../localization/runtime";
import type { TeacherFactory } from "./types";
export const loadTeacherRuntime = (url: string) =>
  loadFeature<TeacherFactory>(url, "MelaTeacher3D");

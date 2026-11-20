import catalogue from "../../data/course-catalogue.json";
import legacy from "../../data/content.json";
import type { Section } from "../types";
import type { Language } from "../languages";
export interface CourseResource {
  url: string;
  sha256: string;
  bytes: number;
}
export interface PracticeQuestion {
  question: string;
  options: string[];
  correct: number;
  rationale: string;
  sourceId: string;
}
export interface CoursePack {
  version: 1;
  id: string;
  title: string;
  revision: string;
  source: string;
  languages: Language[];
  sections: Section[];
  resources: CourseResource[];
  practice: PracticeQuestion[];
  notice: string;
}
export const courses = catalogue as CoursePack[];
export const defaultCourse = () =>
  process.env.DEFAULT_COURSE_ID || "va-foundations";
const canonicalCourses = new Set(courses.map((c) => c.id));
export const supersededFixtureIds = new Set(
  legacy.filter((s) => canonicalCourses.has(s.courseId)).map((s) => s.id),
);
export const builtinSections = () =>
  [
    ...courses.flatMap((c) => c.sections),
    ...legacy.filter((s) => !canonicalCourses.has(s.courseId)),
  ] as Section[];
export function courseById(id: string) {
  return courses.find((c) => c.id === id);
}

export type Language = "en" | "am";
export interface Section {
  id: string;
  title: string;
  content: string;
  url: string;
  language?: Language;
  courseId?: string;
  keywords?: string[];
}
export interface LearningContext {
  pageType: "dashboard" | "lesson" | "jobs" | "unknown";
  courseId?: string;
  courseTitle?: string;
  moduleTitle?: string;
  lessonTitle?: string;
  sections: Section[];
}
export interface Citation {
  id: string;
  title: string;
  url: string;
  excerpt: string;
}
export interface Answer {
  answer: string;
  citations: Citation[];
  provider: "none" | "local" | "cloud";
  matched: boolean;
  actions: string[];
}
export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  description: string;
  accommodations: string[];
  keywords: string[];
}

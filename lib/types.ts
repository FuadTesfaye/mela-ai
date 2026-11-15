export type Language = "en" | "am";
export interface Section {
  id: string;
  title: string;
  content: string;
  url: string;
  language?: Language;
  courseId?: string;
  keywords?: string[];
  start?: number;
  end?: number;
}
export interface VideoSnapshot {
  videoId: string;
  url: string;
  title: string;
  currentTime: number;
  duration: number;
  transcriptRevision?: string;
}
export interface LearningContext {
  pageType: "dashboard" | "lesson" | "jobs" | "unknown";
  courseId?: string;
  courseTitle?: string;
  moduleTitle?: string;
  lessonTitle?: string;
  sections: Section[];
  video?: VideoSnapshot;
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
  provider: "none" | "local" | "cloud" | "gemini";
  notice?: string;
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

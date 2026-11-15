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
export type ExplanationMode="auto"|"simple"|"example"|"steps"|"diagram";
export type ExplanationBlock=
 |{kind:"paragraph"|"example";text:string;sourceIds:string[]}
 |{kind:"steps";items:string[];sourceIds:string[]}
 |{kind:"diagram";title:string;description:string;nodes:{id:string;label:string}[];edges:{from:string;to:string;label?:string}[];sourceIds:string[]};
export interface Answer {
  answer: string;
  citations: Citation[];
  provider: "none" | "local" | "cloud" | "gemini";
  notice?: string;
  summary?:string;
  blocks?:ExplanationBlock[];
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

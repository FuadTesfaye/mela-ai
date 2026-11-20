export interface MelaOptions {
  container: HTMLElement | string;
  api: string;
  videoUrl?: string;
  lessonId?: string;
  language?: "en" | "am" | "om" | "ti";
  assistant?: boolean;
  renderer?: "auto" | "2d" | "3d";
  contextRoot?: HTMLElement | string;
  contentUrl?: string;
  actions?: boolean;
}
export interface MelaHandle {
  element: HTMLElement;
  media: HTMLElement;
  assistant?: HTMLElement;
  setVideo(url: string): void;
  setLanguage(language: "en" | "am" | "om" | "ti"): void;
  openActions(): Promise<void>;
  downloadUrl: string;
  destroy(): void;
}
export declare function register(): Promise<void>;
export declare function mount(options: MelaOptions): Promise<MelaHandle>;

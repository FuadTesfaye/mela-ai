export interface MelaOptions {
  container: HTMLElement | string;
  api: string;
  videoUrl?: string;
  lessonId?: string;
  language?: "en" | "am";
  assistant?: boolean;
  contextRoot?: HTMLElement | string;
}
export interface MelaHandle {
  element: HTMLElement;
  media: HTMLElement;
  assistant?: HTMLElement;
  setVideo(url: string): void;
  destroy(): void;
}
export declare function register(): Promise<void>;
export declare function mount(options: MelaOptions): Promise<MelaHandle>;

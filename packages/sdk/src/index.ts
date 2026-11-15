import { DEFAULT_LESSON_VIDEO } from "../../../lib/media/lesson-catalog";
import { youtubeUrl } from "../../../lib/media/youtube";
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
export async function register() {
  if (typeof window === "undefined")
    throw new Error("Register MELA in the browser after mounting your page.");
  await Promise.all([
    import("../../../module/media/course-media"),
    import("../../../module/db-assistant"),
  ]);
}
const contextOwners = new WeakMap<
  HTMLElement,
  { count: number; previous: string | null }
>();
function find(target: HTMLElement | string) {
  const element =
    typeof target === "string"
      ? document.querySelector<HTMLElement>(target)
      : target;
  if (!element) throw new Error("MELA container was not found.");
  return element;
}
export async function mount(options: MelaOptions): Promise<MelaHandle> {
  await register();
  const container = find(options.container);
  const api = new URL(options.api, location.href);
  if (!["https:", "http:"].includes(api.protocol))
    throw new Error("MELA api must be an HTTP(S) URL.");
  const root = document.createElement("section");
  root.dataset.melaContext = "";
  root.dataset.melaSdkRoot = "";
  root.setAttribute("aria-label", "MELA learning companion");
  root.style.cssText = "display:block;width:100%;min-width:0";
  const media = document.createElement("mela-course-media");
  media.setAttribute("api", api.href.replace(/\/$/, ""));
  media.setAttribute("lesson-id", options.lessonId || "va-future");
  media.setAttribute(
    "video-src",
    youtubeUrl(options.videoUrl || DEFAULT_LESSON_VIDEO.videoUrl),
  );
  root.append(media);
  let assistant: HTMLElement | undefined;
  if (options.assistant !== false) {
    assistant = document.createElement("db-assistant");
    assistant.setAttribute("api", api.href.replace(/\/$/, ""));
    assistant.setAttribute(
      "content",
      new URL("/content.json", api.origin).href,
    );
    assistant.setAttribute("lang", options.language || "en");
    root.append(assistant);
  }
  const context = options.contextRoot ? find(options.contextRoot) : undefined;
  if (context) {
    const entry = contextOwners.get(context);
    contextOwners.set(context, {
      count: (entry?.count || 0) + 1,
      previous: entry
        ? entry.previous
        : context.getAttribute("data-mela-context"),
    });
    context.setAttribute("data-mela-context", "");
  }
  if (assistant)
    (assistant as HTMLElement & { contextRoot?: HTMLElement }).contextRoot =
      context || root;
  container.append(root);
  let destroyed = false;
  return {
    element: root,
    media,
    assistant,
    setVideo(url) {
      if (destroyed) throw new Error("This MELA instance has been destroyed.");
      media.setAttribute("video-src", youtubeUrl(url));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.remove();
      if (context) {
        const entry = contextOwners.get(context);
        if (entry && entry.count > 1) entry.count--;
        else if (entry) {
          if (entry.previous === null)
            context.removeAttribute("data-mela-context");
          else context.setAttribute("data-mela-context", entry.previous);
          contextOwners.delete(context);
        }
      }
    },
  };
}

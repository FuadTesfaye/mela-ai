import { isLanguage } from "../../../lib/languages";
import {
  initialLanguage,
  setLanguage,
} from "../../../module/localization/language";
import { DEFAULT_LESSON_VIDEO } from "../../../lib/media/lesson-catalog";
import { youtubeUrl } from "../../../lib/media/youtube";
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
export async function register() {
  if (typeof window === "undefined")
    throw new Error("Register MELA in a browser.");
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
    throw new Error("Use an HTTP(S) API URL.");
  const root = document.createElement("section");
  root.dataset.melaContext = "";
  root.dataset.melaLanguage = options.language || initialLanguage(root);
  root.dataset.melaSdkRoot = "";
  root.setAttribute("aria-label", "MELA learning companion");
  root.style.cssText = "display:block;width:100%;min-width:0";
  const media = document.createElement("mela-course-media");
  media.setAttribute("lang", root.dataset.melaLanguage);
  media.setAttribute("api", api.href.replace(/\/$/, ""));
  media.setAttribute("lesson-id", options.lessonId || "va-future");
  media.setAttribute(
    "video-src",
    youtubeUrl(options.videoUrl || DEFAULT_LESSON_VIDEO.videoUrl),
  );
  if (options.renderer) media.setAttribute("renderer", options.renderer);
  root.append(media);
  let assistant: HTMLElement | undefined;
  if (options.assistant !== false) {
    assistant = document.createElement("db-assistant");
    assistant.setAttribute("api", api.href.replace(/\/$/, ""));
    assistant.setAttribute(
      "content",
      new URL(options.contentUrl || "/content.json", api.origin).href,
    );
    assistant.setAttribute("lang", root.dataset.melaLanguage);
    root.append(assistant);
  }
  const context = options.contextRoot ? find(options.contextRoot) : undefined;
  (media as HTMLElement & { contextRoot?: HTMLElement }).contextRoot = context;
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
  let actions:
    | {
        open(): void;
        destroy(): void;
        setLanguage(language: import("../../../lib/types").Language): void;
      }
    | undefined;
  return {
    element: root,
    media,
    assistant,
    downloadUrl: new URL("/offline.html", api.origin).href,
    async openActions() {
      if (destroyed) throw new Error("MELA instance destroyed.");
      if (!options.actions) throw new Error("Enable actions first.");
      if (!actions) {
        const { loadFeature } = await import(
          "../../../module/localization/runtime"
        );
        const feature = await loadFeature<{
          mountActions: (options: {
            root?: ParentNode;
            api: string;
            language: import("../../../lib/types").Language;
          }) => NonNullable<typeof actions>;
        }>(new URL("/actions.js", api.origin).href, "MelaActions");
        if (destroyed) return;
        actions = feature.mountActions({
          root: context || root,
          api: api.href.replace(/\/$/, "") + "/v1",
          language: root.dataset
            .melaLanguage as import("../../../lib/types").Language,
        });
      }
      actions.open();
    },
    setLanguage(language) {
      if (destroyed) throw new Error("MELA instance destroyed.");
      if (!isLanguage(language)) throw new Error("Unsupported language.");
      setLanguage(root, language);
      actions?.setLanguage(language);
    },
    setVideo(url) {
      if (destroyed) throw new Error("MELA instance destroyed.");
      media.setAttribute("video-src", youtubeUrl(url));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      actions?.destroy();
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

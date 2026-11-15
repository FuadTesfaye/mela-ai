import type { LearningContext, Section } from "../../lib/types";
function clean(node: HTMLElement) {
  const copy = node.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll(
      "[data-private],form,input,textarea,select,script,style,nav,template,[hidden],.modal,[contenteditable=true]",
    )
    .forEach((child) => child.remove());
  return copy;
}
export function detectContext(
  includePublicPage = false,
  contextRoot?: HTMLElement,
): LearningContext {
  const root =
    contextRoot ||
    document.querySelector<HTMLElement>("[data-mela-context]") ||
    document.querySelector<HTMLElement>("main,article");
  if (!root) return { pageType: "unknown", sections: [] };
  const sections: Section[] = [];
  const add = (
    id: string,
    title: string,
    content: string,
    language: "en" | "am" = "en",
    anchor = id,
    sourceUrl?: string,
  ) => {
    let url: URL;
    try {
      url = new URL(sourceUrl || location.href, location.href);
    } catch {
      return;
    }
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (!sourceUrl) {
      url.hash = anchor;
      url.search = "";
    }
    const text = content.trim();
    if (!text) return;
    sections.push({
      id: id.slice(0, 100),
      title: title.trim().slice(0, 300),
      content: text.slice(0, 6000),
      url: url.href,
      courseId: root.dataset.courseId,
      language,
    });
  };
  // These selectors are the authored lesson region in the pinned Savanna capture.
  const authored = root.matches("[data-mela-context]")
    ? root.querySelector<HTMLElement>(".formatted-content .savanna-styles")
    : null;
  if (authored && !authored.querySelector("[data-mela-section]")) {
    let title = root.dataset.lessonTitle || "Current lesson";
    let anchor = "curriculum_navigation_content";
    let text = "";
    let index = 0;
    const flush = () => {
      if (text.trim()) add(`savanna-${index++}`, title, text, "en", anchor);
      text = "";
    };
    for (const raw of authored.childNodes) {
      if (raw.nodeType === 3) {
        text += " " + (raw.textContent || "");
        continue;
      }
      if (raw.nodeType !== 1) continue;
      const child = raw as HTMLElement;
      if (child.matches("h2,h3,h4")) {
        flush();
        title = child.textContent?.trim() || title;
        anchor =
          child.querySelector<HTMLElement>("a[id]")?.id ||
          child.id ||
          "curriculum_navigation_content";
      } else if (
        !child.matches("script,style,template,[hidden],form,[data-private]")
      ) {
        const value = clean(child as HTMLElement).textContent?.trim() || "";
        if (text.length + value.length > 5500) flush();
        text += "\n" + value;
      }
    }
    flush();
  }
  root
    .querySelectorAll<HTMLElement>("[data-mela-section]")
    .forEach((node, i) => {
      if (node.closest("[data-private],form,nav")) return;
      const copy = clean(node);
      const id = node.id || `mela-section-${i}`;
      if (!node.id) node.id = id;
      add(
        id,
        copy.querySelector("h2,h3,h4,h5")?.textContent ||
          root.dataset.lessonTitle ||
          "Current page",
        (copy.querySelector("[data-mela-content]") || copy).textContent || "",
        node.lang === "am" ? "am" : "en",
        id,
        node.dataset.melaSourceUrl,
      );
    });
  // Generic hosts must opt in from the widget before their public text is used.
  if (!sections.length && includePublicPage) {
    let index = 0;
    for (const node of root.querySelectorAll<HTMLElement>("h1,h2,h3,p,li")) {
      if (
        node.closest(
          "[data-private],form,nav,[hidden],.modal,[contenteditable=true]",
        )
      )
        continue;
      const text = clean(node).textContent?.trim() || "";
      if (text.length < 15) continue;
      const id = node.id || `mela-page-${index++}`;
      if (!node.id) node.id = id;
      add(
        id,
        root.querySelector("h1")?.textContent || document.title,
        text,
        document.documentElement.lang === "am" ? "am" : "en",
      );
      if (sections.length >= 20) break;
    }
  }
  const explicit = root.dataset.pageType;
  return {
    pageType:
      explicit === "jobs"
        ? "jobs"
        : explicit === "dashboard"
          ? "dashboard"
          : sections.length
            ? "lesson"
            : root.dataset.courseId
              ? "dashboard"
              : "unknown",
    courseId: root.dataset.courseId,
    courseTitle: root.dataset.courseTitle,
    moduleTitle:
      root
        .querySelector("button[data-section-index].bg-light")
        ?.textContent?.trim() ||
      root
        .querySelector(".homepage-nav .nav-link.active[data-track-id]")
        ?.textContent?.trim() ||
      root.dataset.moduleTitle,
    lessonTitle: root.dataset.lessonTitle,
    sections: sections.slice(0, 30),
  };
}

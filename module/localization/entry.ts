import { detectContext } from "../context/savanna-adapter";
import { languageRoot, setLanguage } from "./language";
import {
  dictionary,
  asset,
  cacheGet,
  cachePut,
  clearCache,
  translatedItems,
} from "./client";
import {
  lessonItems,
  preparedTranslator,
  type AmharicPack,
  type PreparedEntry,
  type TranslationItem,
} from "../../lib/localization/shared";
import {
  transcriptRevision,
  type VideoCue,
} from "../../lib/media/video-context";
import type { LearningContext, Language } from "../../lib/types";
import type { Transcript } from "../../lib/media/transcript";
type Host = HTMLElement & {
  contextRoot?: HTMLElement;
  useLessonContext?: () => void;
  getLearningContext?: () => LearningContext;
  getTranscript?: () => Transcript | undefined;
  setTranslatedCues?: (value?: { revision: string; cues: VideoCue[] }) => void;
  installTranslations?: (ui: Record<string, string>) => void;
  installEvidence?: (
    entries: PreparedEntry[],
    glossary: Record<string, string[]>,
  ) => void;
};
const mounted = new WeakMap<HTMLElement, { ready: () => Promise<void> }>();
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
};
function contextFor(host: Host) {
  if (host.getLearningContext) return host.getLearningContext();
  const root = languageRoot(host),
    assistant = root.querySelector<Host>("db-assistant");
  return (
    assistant?.getLearningContext?.() ||
    detectContext(
      false,
      host.contextRoot || (root === document.body ? undefined : root),
    )
  );
}
function contextKey(context: LearningContext) {
  return JSON.stringify([
    context.courseId,
    context.lessonTitle,
    context.sections
      .filter((s) => !s.id.startsWith("video-"))
      .map((s) => [s.id, s.content]),
  ]);
}
function install(host: Host, pack: AmharicPack, extra: PreparedEntry[] = []) {
  const root = languageRoot(host);
  const nodes =
    root === host ? [host] : [...root.querySelectorAll<Host>("db-assistant")];
  for (const node of nodes) {
    node.installTranslations?.(pack.ui);
    node.installEvidence?.([...pack.entries, ...extra], pack.glossary);
  }
}
const fonts = new Set<string>();
function installFont(host: HTMLElement) {
  const url = asset(host, "/fonts/noto-sans-ethiopic.woff2");
  if (typeof FontFace === "undefined" || fonts.has(url)) return;
  fonts.add(url);
  void (async () => {
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Font");
      bytes = await response.arrayBuffer();
      await cachePut("font:" + url, bytes);
    } catch {
      const saved = await cacheGet<ArrayBuffer>("font:" + url);
      if (!saved) throw new Error("Font unavailable");
      bytes = saved;
    }
    const face = new FontFace("MelaEthiopic", bytes, { display: "swap" });
    document.fonts.add(face);
    await face.load();
  })().catch(() => fonts.delete(url));
}
const pending = new WeakMap<HTMLElement, Promise<unknown>>();
function queued<T>(host: Host, job: () => Promise<T>) {
  const root = languageRoot(host);
  const before = pending.get(root) || Promise.resolve();
  const next = before.catch(() => {}).then(job);
  pending.set(root, next);
  return next;
}
export async function mount(element: HTMLElement) {
  const host = element as Host,
    existing = mounted.get(host);
  if (existing) {
    return existing.ready();
  }
  const root = host.shadowRoot;
  if (!root) return;
  installFont(host);
  if ("serviceWorker" in navigator)
    void navigator.serviceWorker.ready
      .then((registration) => {
        if (
          new URL(registration.scope).origin ===
          new URL(asset(host, "/locale.js")).origin
        )
          registration.active?.postMessage({ type: "mela:cache-language" });
      })
      .catch(() => {});
  const styles = make("style");
  styles.textContent = ` :host([lang=am]){font-family:MelaEthiopic,"Noto Sans Ethiopic",Arial,sans-serif} :host([lang=am]) button,:host([lang=am]) select,:host([lang=am]) textarea,:host([lang=am]) .card{font-family:inherit}.bar{flex-wrap:wrap}.bar strong{flex:1 1 230px}.course-language{min-height:44px;max-width:100%;padding:8px}.mela-reader{font-family:MelaEthiopic,"Noto Sans Ethiopic",Arial,sans-serif;width:min(840px,95vw);max-height:90dvh;overflow:auto;border:1px solid #7fa7b8;border-radius:12px;padding:22px;color:#17394e;background:white;font-size:16px;line-height:1.9}.mela-reader::backdrop{background:#062c4088}.mela-reader header{display:flex;gap:12px;justify-content:space-between;align-items:start;position:sticky;top:-22px;padding:12px 0;background:white;z-index:1}.mela-reader h2{font-size:24px;margin:0}.mela-reader section{border-top:1px solid #d4e4ec;margin-top:18px;padding-top:14px}.mela-reader p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}.mela-reader pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf4f8;padding:12px}.mela-reader button{min-height:44px;padding:9px;border:1px solid #91afbd;border-radius:6px;background:#fff;color:#17394e;cursor:pointer;font:inherit}.mela-reader button:focus-visible,.mela-reader summary:focus-visible,.mela-reader a:focus-visible{outline:3px solid #a96410;outline-offset:3px}.mela-reader details{margin:12px 0}.mela-reader summary{cursor:pointer;min-height:44px}.mela-reader label{display:flex;gap:10px;margin:14px 0}.mela-reader a{color:#00667e}.mela-reader small,.translation-tools{font-size:13px}.translation-tools{padding:10px;line-height:1.8;color:#214c60}.translation-tools button{margin:6px 0}.mela-reader .notice{background:#eef6f9;padding:12px;border-radius:6px}.mela-reader .translate-action{background:#006b89;color:white}@media(prefers-reduced-motion:reduce){.mela-reader{scroll-behavior:auto}}`;
  root.append(styles);
  let pack: AmharicPack | undefined,
    version = 0,
    dialog: HTMLDialogElement | undefined,
    videoKey = "",
    captionPack: AmharicPack | undefined;
  const original = new WeakMap<Node, { en: string; am: string }>(),
    attributes = new WeakMap<
      Element,
      Map<string, { en: string; am: string }>
    >();
  const language = (): Language =>
    host.getAttribute("lang") === "am" ? "am" : "en";
  const label = (text: string) => pack?.ui[text] || text;
  function localize() {
    if (!pack || !host.isConnected) return;
    const am = language() === "am",
      lookup = preparedTranslator(pack.entries);
    const translate = (text: string) =>
      pack!.ui[text] ||
      lookup(text) ||
      (text.includes(" · ")
        ? text
            .split(" · ")
            .map((part) => pack!.ui[part] || part)
            .join(" · ")
        : undefined);
    const walker = document.createTreeWalker(root!, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          "style,script,textarea,.cue,.mela-reader,.sources,.role,.gesture-description,.spelling-label",
        )
      )
        continue;
      if (parent.closest(".messages") && !parent.closest(".message-actions"))
        continue;
      if (
        parent.closest(".caption-words") &&
        !pack.ui[(node.nodeValue || "").trim()]
      )
        continue;
      const current = node.nodeValue || "",
        saved = original.get(node);
      if (saved && current === saved.am) {
        if (!am) node.nodeValue = saved.en;
        continue;
      }
      if (!am) continue;
      const clean = current.trim();
      if (!clean) continue;
      const target = translate(clean);
      if (target && target !== clean) {
        const value = current.replace(clean, target);
        original.set(node, { en: current, am: value });
        node.nodeValue = value;
        if (parent.closest(".caption-words")) parent.lang = "am";
      }
    }
    for (const element of root!.querySelectorAll<HTMLElement>(
      "[aria-label],[title],[placeholder]",
    )) {
      if (
        element.closest(".messages,.mela-reader") &&
        !element.closest(".message-actions")
      )
        continue;
      let values = attributes.get(element);
      if (!values) {
        values = new Map();
        attributes.set(element, values);
      }
      for (const name of ["aria-label", "title", "placeholder"]) {
        const value = element.getAttribute(name);
        if (!value || value === "Language / ቋንቋ") continue;
        const saved = values.get(name);
        if (saved && value === saved.am) {
          if (!am) element.setAttribute(name, saved.en);
          continue;
        }
        const target = am ? translate(value) : undefined;
        if (target && target !== value) {
          values.set(name, { en: value, am: target });
          element.setAttribute(name, target);
        }
      }
    }
    if (am)
      root!
        .querySelector<HTMLElement>(".panel,.card")
        ?.setAttribute("lang", "am");
    else
      root!
        .querySelector<HTMLElement>(".panel,.card")
        ?.setAttribute("lang", "en");
  }
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        localize();
      });
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  function report(text: string) {
    let node = root!.querySelector<HTMLElement>(".translation-tools");
    if (!node) {
      node = make("div");
      node.className = "translation-tools";
      node.setAttribute("role", "status");
      (root!.querySelector(".body") || root!).append(node);
    }
    node.textContent = text;
    return node;
  }
  async function captions(consent = false) {
    if (language() !== "am" || !host.getTranscript) return;
    const source = host.getTranscript();
    if (!source || !pack) return;
    const revision = transcriptRevision(source.videoUrl, source.cues),
      key = source.videoUrl + ":" + revision;
    if (!consent && videoKey === key) return;
    videoKey = key;
    const sequence = version;
    const current = () =>
      host.isConnected &&
      language() === "am" &&
      version === sequence &&
      host.getTranscript?.() === source;
    const videoId = new URL(source.videoUrl).searchParams.get("v")!;
    let saved = await cacheGet<{ revision: string; entries: PreparedEntry[] }>(
      "video:" + key,
    );
    if (!saved || saved.revision !== revision)
      try {
        const response = await fetch(
          asset(host, `/transcripts/${videoId}.am.json`),
          { signal: AbortSignal.timeout(8000) },
        );
        if (response.ok) {
          const value = await response.json();
          if (
            value.version === 1 &&
            value.revision === revision &&
            Array.isArray(value.entries) &&
            value.entries.length === source.cues.length &&
            value.entries.every(
              (e: PreparedEntry, i: number) =>
                e.sourceText === source.cues[i].text &&
                typeof e.targetText === "string" &&
                e.targetText.length <= 1500,
            )
          ) {
            saved = value;
            await cachePut("video:" + key, value);
          }
        }
      } catch {}
    if (!current()) return;
    captionPack = {
      ...pack,
      entries: [...pack.entries, ...(saved?.entries || [])],
    };
    const items = source.cues.map((cue, i) => ({
      id: "cue-" + i,
      text: cue.text,
    }));
    const result = await queued(host, () =>
      translatedItems(host, items, captionPack!, consent, () => {
        if (!current()) throw new Error("Translation cancelled.");
      }),
    );
    if (!current()) return;
    const entries = source.cues
      .filter((_, i) => result.has("cue-" + i))
      .map((cue) => ({
        sourceText: cue.text,
        targetText: result.get("cue-" + source.cues.indexOf(cue))!,
      }));
    install(host, pack, entries);
    if (result.size === items.length) {
      host.setTranslatedCues?.({
        revision,
        cues: source.cues.map((cue, i) => ({
          ...cue,
          text: result.get("cue-" + i)!,
        })),
      });
      report("የአማርኛ ትርጉም ዝግጁ ነው። የቋንቋ ባለሙያ ግምገማ ይጠበቃል።");
    } else {
      const tools = report(
        "የዚህ ቪዲዮ የአማርኛ ትርጉም ገና አልተዘጋጀም። የእንግሊዝኛ ምንጩ እየታየ ነው።",
      );
      const button = make("button", "የድምፅ ጽሑፉን ተርጉም");
      button.type = "button";
      button.onclick = () => void reader(true);
      tools.append(button);
    }
  }
  async function reader(video = false) {
    if (dialog?.open) {
      dialog.focus();
      return;
    }
    (host.useLessonContext
      ? host
      : languageRoot(host).querySelector<Host>("db-assistant")
    )?.useLessonContext?.();
    setLanguage(host, "am", true);
    const currentPack = await dictionary(host);
    pack = currentPack;
    install(host, currentPack);
    const context = contextFor(host),
      key = contextKey(context),
      source = host.getTranscript?.();
    const sections =
      video && source
        ? source.cues.map((cue, i) => ({
            id: "cue-" + i,
            title: `${Math.floor(cue.start / 60)}:${String(Math.floor(cue.start % 60)).padStart(2, "0")}`,
            content: cue.text,
            url: source.videoUrl + "&t=" + Math.floor(cue.start),
          }))
        : context.sections.filter((s) => !s.id.startsWith("video-"));
    const codeTexts = [
      ...(host.contextRoot || languageRoot(host)).querySelectorAll<HTMLElement>(
        "pre",
      ),
    ]
      .filter((node) => !node.closest("[data-private],form,[hidden]"))
      .map((node) => node.textContent || "")
      .filter(Boolean);
    const rows = sections.map((section) => {
      let text = section.content;
      for (const code of codeTexts)
        if (text.includes(code))
          text = text.replace(code, "```" + code + "```");
      return {
        section,
        items: [
          { id: section.id + ":title", text: section.title },
          ...lessonItems(section.id, text),
        ],
      };
    });
    const items = rows.flatMap((row) => row.items),
      allItems = video
        ? items.filter((item) => !item.id.endsWith(":title"))
        : items;
    const activePack = video && captionPack ? captionPack : currentPack;
    const startVersion = version;
    const valid = () =>
      host.isConnected &&
      language() === "am" &&
      version === startVersion &&
      (video
        ? host.getTranscript?.() === source
        : contextKey(contextFor(host)) === key);
    const focus = root!.activeElement as HTMLElement | null;
    const modal = make("dialog");
    dialog = modal;
    modal.className = "mela-reader";
    modal.lang = "am";
    modal.setAttribute("aria-labelledby", "mela-reader-title");
    const header = make("header"),
      title = make("h2", video ? "የቪዲዮ ጽሑፍ በአማርኛ" : "ትምህርቱን በአማርኛ ያንብቡ");
    title.id = "mela-reader-title";
    const close = make("button", "ዝጋ");
    close.type = "button";
    close.onclick = () => modal.close();
    header.append(title, close);
    const notice = make(
      "p",
      "የትርጉም ረቂቅ፤ የቋንቋ ባለሙያ ግምገማ ይጠበቃል። የእንግሊዝኛ ምንጩን ማየት ይችላሉ።",
    );
    notice.className = "notice";
    notice.setAttribute("role", "status");
    const content = make("div"),
      controls = make("div");
    modal.append(header, notice, content, controls);
    modal.addEventListener(
      "close",
      () => {
        modal.remove();
        if (dialog === modal) dialog = undefined;
        focus?.isConnected && focus.focus();
      },
      { once: true },
    );
    root!.append(modal);
    modal.showModal();
    close.focus();
    let displayed = new Map<string, string>();
    const render = () => {
      content.replaceChildren();
      for (const row of rows) {
        const section = make("section"),
          heading = make(
            "h3",
            displayed.get(row.section.id + ":title") ||
              currentPack.entries.find(
                (e) => e.sourceText === row.section.title,
              )?.targetText ||
              row.section.title,
          );
        section.append(heading);
        for (const item of row.items.filter(
          (item) => !item.id.endsWith(":title"),
        )) {
          const translated = displayed.get(item.id);
          const p = make(
            item.kind === "code" ? "pre" : "p",
            translated || item.text,
          );
          p.lang = translated && item.kind !== "code" ? "am" : "en";
          section.append(p);
        }
        const original = make("details"),
          summary = make("summary", "የእንግሊዝኛ ምንጩን አሳይ");
        const text = make("p", row.section.content);
        text.lang = "en";
        original.append(summary, text);
        section.append(original);
        const link = make("a", "የትምህርቱን ምንጭ ክፈት");
        const url = new URL(row.section.url, location.href);
        if (["http:", "https:"].includes(url.protocol)) {
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          section.append(link);
        }
        content.append(section);
      }
      if (!rows.length)
        content.append(
          make(
            "p",
            "የትምህርት ጽሑፍ አልተገኘም። በተደገፈ የትምህርት ገጽ ላይ ይሞክሩ ወይም የገጽ መረጃን ያብሩ።",
          ),
        );
    };
    displayed = await translatedItems(host, allItems, activePack);
    if (!valid() || !modal.open) {
      modal.close();
      return;
    }
    render();
    const extra: PreparedEntry[] = [];
    const installRows = () => {
      for (const row of rows) {
        const body = row.items.filter((i) => !i.id.endsWith(":title"));
        if (body.every((i) => displayed.has(i.id)))
          extra.push({
            sourceText: row.section.content,
            targetText: body.map((i) => displayed.get(i.id)).join("\n"),
          });
      }
      install(host, currentPack, extra);
    };
    installRows();
    if (displayed.size < allItems.length) {
      notice.textContent =
        "ያልተተረጎመው ክፍል በእንግሊዝኛ እየታየ ነው። ፈቃድ ሲሰጡ የተመረጠው ጽሑፍ ለGemini ይላካል። ትርጉሞች በዚህ መሣሪያ ይቀመጣሉ።";
      const preview = make("details"),
        shared = make(
          "p",
          allItems
            .filter((i) => !displayed.has(i.id) && i.kind !== "code")
            .map((i) => i.text)
            .join("\n\n"),
        );
      shared.lang = "en";
      preview.append(make("summary", "ለGemini የሚላከውን ጽሑፍ ይመልከቱ"), shared);
      const label = make("label"),
        consent = make("input");
      consent.type = "checkbox";
      label.append(
        consent,
        document.createTextNode("የተመረጠውን ጽሑፍ ለትርጉም ለGemini ለመላክ እፈቅዳለሁ።"),
      );
      const action = make("button", "የጎደለውን ትርጉም አዘጋጅ");
      action.type = "button";
      action.className = "translate-action";
      action.disabled = true;
      consent.onchange = () => {
        action.disabled = !consent.checked;
      };
      action.onclick = async () => {
        if (!consent.checked || !valid()) return;
        action.disabled = true;
        consent.disabled = true;
        try {
          displayed = await queued(host, () =>
            translatedItems(host, allItems, activePack, true, (done, total) => {
              if (!valid() || !modal.open)
                throw new Error("የትምህርቱ አውድ ተቀይሯል። እንደገና ይክፈቱ።");
              notice.textContent = `ትርጉም በማዘጋጀት ላይ፦ ${done}/${total}`;
            }),
          );
          if (!valid() || !modal.open) return;
          render();
          installRows();
          notice.textContent = "ትርጉሙ ተዘጋጅቷል። ይህ ረቂቅ ነው፤ ትክክለኛነቱን ይገምግሙ።";
          controls.replaceChildren();
          if (video) {
            videoKey = "";
            await captions();
          }
        } catch (error) {
          if (modal.open)
            notice.textContent =
              error instanceof Error
                ? error.message
                : "ትርጉም አልተሳካም። የእንግሊዝኛ ምንጩን ይጠቀሙ።";
          action.disabled = !consent.checked;
          consent.disabled = false;
        }
      };
      controls.append(preview, label, action);
    }
    const remove = make("button", "የተቀመጡ ትርጉሞችን አስወግድ");
    remove.type = "button";
    remove.onclick = async () => {
      await clearCache();
      notice.textContent = "በዚህ መሣሪያ የተቀመጡ ትርጉሞች ተወግደዋል።";
    };
    modal.append(remove);
  }
  async function ensureLocale() {
    if (!styles.isConnected) root!.append(styles);
    pack = await dictionary(host);
    if (host.isConnected) {
      install(host, pack);
      localize();
    }
  }
  async function refresh() {
    if (!styles.isConnected) root!.append(styles);
    version++;
    videoKey = "";
    if (language() !== "am") {
      host.setTranslatedCues?.();
      localize();
      root!.querySelector(".translation-tools")?.remove();
      return;
    }
    try {
      await ensureLocale();
      if (!host.isConnected || language() !== "am") return;
      void captions().catch((error) => {
        if (host.isConnected && language() === "am") report(error.message);
      });
    } catch (error) {
      if (host.isConnected)
        report(error instanceof Error ? error.message : "የአማርኛ መረጃ አልተጫነም።");
    }
  }
  host.addEventListener(
    "mela:read-lesson",
    () =>
      void reader().catch((error) => report(String(error.message || error))),
  );
  host.addEventListener("mela:transcript-ready", () => {
    videoKey = "";
    void captions().catch((error) => {
      if (host.isConnected && language() === "am") report(error.message);
    });
  });
  const attributesObserver = new MutationObserver((records) => {
    if (
      records.some(
        (r) => r.attributeName === "lang" || r.attributeName === "video-src",
      )
    ) {
      dialog?.close();
      void refresh();
    }
  });
  attributesObserver.observe(host, {
    attributes: true,
    attributeFilter: ["lang", "video-src"],
  });
  mounted.set(host, { ready: ensureLocale });
  await refresh();
}

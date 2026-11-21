/** Structured extraction of the public content of the current page.
 * Form field VALUES, passwords and MELA's own UI are never included. */
export type PageData = {
  url: string;
  title: string;
  description: string;
  language: string;
  extractedAt: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  links: { text: string; url: string }[];
  images: { alt: string; src: string }[];
  tables: string[][][];
  lists: string[][];
  forms: { fields: { label: string; type: string; name: string }[] }[];
  buttons: string[];
  text: string;
};

const skip =
  "script,style,noscript,template,svg,[hidden],[aria-hidden='true'],[data-mela-actions-ui],[data-private]";
const clean = (value: string | null | undefined, max = 500) =>
  (value || "").replace(/\s+/g, " ").trim().slice(0, max);

function shown(element: Element) {
  return (
    !element.closest(skip) &&
    (element as HTMLElement).getClientRects().length > 0
  );
}

function labelFor(field: HTMLElement) {
  const input = field as HTMLInputElement;
  return clean(
    input.labels?.[0]?.textContent ||
      field.getAttribute("aria-label") ||
      field.getAttribute("placeholder") ||
      field.getAttribute("name") ||
      field.id,
    120,
  );
}

export function extractPage(doc: Document = document): PageData {
  const all = <T extends Element>(selector: string) =>
    Array.from(doc.querySelectorAll<T>(selector)).filter(shown);
  const root =
    doc.querySelector<HTMLElement>('main,article,[role="main"]') || doc.body;
  const headings = all<HTMLElement>("h1,h2,h3,h4")
    .map((h) => ({
      level: Number(h.tagName[1]),
      text: clean(h.textContent, 200),
    }))
    .filter((h) => h.text)
    .slice(0, 80);
  const paragraphs = Array.from(
    root.querySelectorAll<HTMLElement>("p,li > p,blockquote,dd"),
  )
    .filter(shown)
    .map((p) => clean(p.textContent, 1200))
    .filter((t) => t.length > 20)
    .slice(0, 150);
  const seen = new Set<string>();
  const links = all<HTMLAnchorElement>("a[href]")
    .map((a) => ({
      text: clean(a.textContent || a.getAttribute("aria-label"), 140),
      url: a.href,
    }))
    .filter((l) => {
      if (!/^https?:/.test(l.url) || seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    })
    .slice(0, 200);
  const images = all<HTMLImageElement>("img")
    .map((i) => ({ alt: clean(i.alt, 200), src: i.currentSrc || i.src }))
    .filter((i) => /^https?:/.test(i.src))
    .slice(0, 60);
  const tables = all<HTMLTableElement>("table")
    .slice(0, 10)
    .map((t) =>
      Array.from(t.rows)
        .slice(0, 50)
        .map((r) =>
          Array.from(r.cells)
            .slice(0, 12)
            .map((c) => clean(c.textContent, 200)),
        ),
    );
  const lists = all<HTMLElement>("ul,ol")
    .filter((l) => !l.closest("nav"))
    .slice(0, 20)
    .map((l) =>
      Array.from(l.children)
        .slice(0, 30)
        .map((li) => clean(li.textContent, 300))
        .filter(Boolean),
    )
    .filter((l) => l.length);
  const forms = all<HTMLFormElement>("form")
    .slice(0, 10)
    .map((f) => ({
      fields: Array.from(
        f.querySelectorAll<HTMLElement>("input,select,textarea"),
      )
        .filter((e) => (e as HTMLInputElement).type !== "hidden")
        .slice(0, 40)
        .map((e) => ({
          label: labelFor(e),
          type: (e as HTMLInputElement).type || e.tagName.toLowerCase(),
          name: clean(e.getAttribute("name"), 80),
        })),
    }));
  const buttons = all<HTMLElement>("button,[role=button],input[type=submit]")
    .map((b) =>
      clean(
        b.textContent ||
          b.getAttribute("aria-label") ||
          (b as HTMLInputElement).value,
        80,
      ),
    )
    .filter(Boolean)
    .slice(0, 60);
  const copy = root.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll(skip + ",input,textarea,select")
    .forEach((n) => n.remove());
  return {
    url: location.href,
    title: clean(doc.title, 300),
    description: clean(
      doc.querySelector<HTMLMetaElement>('meta[name="description"]')?.content,
      500,
    ),
    language: doc.documentElement.lang || "",
    extractedAt: new Date().toISOString(),
    headings,
    paragraphs,
    links,
    images,
    tables,
    lists,
    forms,
    buttons,
    text: clean(copy.innerText || copy.textContent, 30000),
  };
}

/** Compact text version used as context for Gemini questions. */
export function pageDataContext(data: PageData) {
  const parts = [
    data.description && `Description: ${data.description}`,
    data.headings.length &&
      "Headings:\n" +
        data.headings.map((h) => `${"#".repeat(h.level)} ${h.text}`).join("\n"),
    data.text && "Text:\n" + data.text.slice(0, 12000),
    data.tables.length &&
      "Tables:\n" +
        data.tables
          .map((t) => t.map((r) => r.join(" | ")).join("\n"))
          .join("\n\n"),
    data.links.length &&
      "Links:\n" +
        data.links
          .slice(0, 60)
          .map((l) => `${l.text || "(no text)"} -> ${l.url}`)
          .join("\n"),
    data.buttons.length && "Buttons: " + data.buttons.join(", "),
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 20000);
}

export function summarizeData(data: PageData) {
  return (
    `Extracted “${data.title || data.url}”: ${data.headings.length} headings, ${data.paragraphs.length} paragraphs, ` +
    `${data.links.length} links, ${data.images.length} images, ${data.tables.length} tables, ${data.lists.length} lists, ` +
    `${data.forms.length} forms and ${data.buttons.length} buttons.` +
    (data.headings.length
      ? `\nMain headings: ${data.headings
          .slice(0, 6)
          .map((h) => h.text)
          .join(" · ")}`
      : "")
  );
}

import { publicPageUrl, type PageSnapshot, MAX_TEXT } from "./model";
const excluded =
  'form,input,textarea,select,button,script,style,template,nav,[data-private],[hidden],[inert],[aria-hidden="true"],[contenteditable],[data-mela-actions-ui]';
function allowed(element: Element, root: Element) {
  if (element.closest(excluded)) return false;
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.contentVisibility === "hidden"
    )
      return false;
  }
  return true;
}
export function capturePage(
  doc: Document = document,
  href = location.href,
): PageSnapshot {
  const url = publicPageUrl(href);
  const root = doc.querySelector(
    'main,article,[role="main"],[data-mela-context]',
  );
  if (!root || !allowed(root, root))
    throw new Error(
      "This page has no public lesson or article region to remember.",
    );
  const read = (element: Element, max: number) => {
    const walker = doc.createTreeWalker(element, 4);
    const pieces: string[] = [];
    let length = 0;
    while (walker.nextNode() && length < max) {
      const node = walker.currentNode;
      if (!node.parentElement || !allowed(node.parentElement, element))
        continue;
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text) {
        pieces.push(text);
        length += text.length + 1;
      }
    }
    return pieces.join(" ").slice(0, max);
  };
  const text = read(root, MAX_TEXT);
  if (!text) throw new Error("No public readable content was found.");
  const headings = Array.from(root.querySelectorAll("h1,h2,h3"))
    .filter((e) => allowed(e, root))
    .slice(0, 12)
    .map((e) => read(e, 160));
  return { url, title: headings[0] || new URL(url).hostname, text, headings };
}

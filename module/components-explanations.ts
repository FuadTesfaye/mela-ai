import type { ExplanationBlock } from "../lib/types";
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  return el;
}
function safeDiagram(block: Extract<ExplanationBlock, { kind: "diagram" }>) {
  if (
    !Array.isArray(block.nodes) ||
    block.nodes.length > 8 ||
    !block.nodes.length ||
    !Array.isArray(block.edges) ||
    block.edges.length > 12
  )
    return false;
  const ids = new Set(block.nodes.map((n) => n.id));
  return (
    ids.size === block.nodes.length &&
    block.nodes.every(
      (n) => typeof n.label === "string" && n.label.length <= 100,
    ) &&
    block.edges.every((e) => ids.has(e.from) && ids.has(e.to))
  );
}
function graph(block: Extract<ExplanationBlock, { kind: "diagram" }>) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 360 ${block.nodes.length * 100}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("explanation-diagram");
  block.nodes.forEach((n, i) => {
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", "15");
    rect.setAttribute("y", String(i * 100 + 8));
    rect.setAttribute("width", "290");
    rect.setAttribute("height", "65");
    rect.setAttribute("rx", "7");
    rect.setAttribute("fill", "#edf8fc");
    rect.setAttribute("stroke", "#006887");
    svg.append(rect);
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", "160");
    text.setAttribute("y", String(i * 100 + 32));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "#143e55");
    text.setAttribute("font-size", "12");
    const words = n.label.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).length > 38 && line) {
        lines.push(line);
        line = word;
      } else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((value, j) => {
      const span = document.createElementNS(NS, "tspan");
      span.setAttribute("x", "160");
      span.setAttribute("dy", j ? "15" : "0");
      span.textContent = value;
      text.append(span);
    });
    svg.append(text);
  });
  for (const edge of block.edges) {
    const from = block.nodes.findIndex((n) => n.id === edge.from),
      to = block.nodes.findIndex((n) => n.id === edge.to);
    const line = document.createElementNS(NS, "path");
    const start = from * 100 + 73,
      end = to * 100 + 8;
    line.setAttribute(
      "d",
      to === from + 1
        ? `M160 ${start} L160 ${end - 6} m-5 -3 l5 6 l5 -6`
        : `M305 ${from * 100 + 40} Q340 ${(from + to) * 50 + 40} 305 ${to * 100 + 40}`,
    );
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#006887");
    line.setAttribute("stroke-width", "2");
    svg.append(line);
  }
  return svg;
}
export function renderExplanationBlocks(
  blocks: ExplanationBlock[],
  host: HTMLElement,
) {
  for (const block of blocks.slice(0, 6)) {
    const section = node("section");
    section.className = "explanation-block";
    if (block.kind === "paragraph" || block.kind === "example") {
      if (typeof block.text !== "string") continue;
      if (block.kind === "example")
        section.append(node("strong", "Illustrative example"));
      section.append(node("p", block.text.slice(0, 3000)));
    } else if (block.kind === "steps") {
      if (!Array.isArray(block.items)) continue;
      section.append(node("strong", "Step by step"));
      const list = node("ol");
      for (const item of block.items.slice(0, 8))
        list.append(node("li", String(item).slice(0, 600)));
      section.append(list);
    } else if (block.kind === "diagram" && safeDiagram(block)) {
      section.append(
        node("strong", String(block.title).slice(0, 160)),
        graph(block),
        node("p", String(block.description).slice(0, 1600)),
      );
      const equivalent = node("details");
      equivalent.append(node("summary", "Diagram as text"));
      const list = node("ul");
      for (const n of block.nodes) list.append(node("li", n.label));
      for (const edge of block.edges)
        list.append(
          node(
            "li",
            `${block.nodes.find((n) => n.id === edge.from)!.label} → ${block.nodes.find((n) => n.id === edge.to)!.label}${edge.label ? ": " + edge.label : ""}`,
          ),
        );
      equivalent.append(list);
      section.append(equivalent);
      const expand = node("button", "Expand diagram");
      expand.type = "button";
      expand.onclick = () => {
        const dialog = node("dialog");
        dialog.className = "diagram-dialog";
        dialog.setAttribute("aria-label", block.title);
        const close = node("button", "Close diagram");
        close.type = "button";
        close.onclick = () => dialog.close();
        dialog.append(
          close,
          node("h2", block.title),
          graph(block),
          node("p", block.description),
          equivalent.cloneNode(true),
        );
        dialog.addEventListener(
          "close",
          () => {
            dialog.remove();
            expand.focus();
          },
          { once: true },
        );
        host.getRootNode().appendChild(dialog);
        if (typeof dialog.showModal === "function") dialog.showModal();
        else {
          dialog.setAttribute("open", "");
          close.onclick = () => {
            dialog.remove();
            expand.focus();
          };
        }
        close.focus();
      };
      section.append(expand);
    } else continue;
    host.append(section);
  }
}

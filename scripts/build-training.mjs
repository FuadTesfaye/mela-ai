import { readFile, writeFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
const data = JSON.parse(
  await readFile("data/training/offline-first-localized-ai.json", "utf8"),
);
const { document } = parseHTML(
  await readFile("public/savanna/pages/concept-with-navigation.html", "utf8"),
);
document.title = data.title + " | Savanna · MELA";
const main = document.querySelector("main#content");
Object.assign(main.dataset, {
  melaContext: "",
  courseId: data.id,
  courseTitle: "AI Engineering · Training Sessions",
  moduleTitle: "Offline-first architecture & localization",
  lessonTitle: data.title,
  lessonId: data.id,
});
const label = main.querySelector(".curriculum-switcher-label .fs-4");
if (label) label.textContent = "AI Engineering · Training Sessions";
const region = document.querySelector("#curriculum_navigation_content");
region.querySelector("h1").textContent = data.title;
const authored = region.querySelector(".savanna-styles");
authored.replaceChildren();
const intro = document.createElement("div");
intro.className = "callout";
const lead = document.createElement("p");
lead.innerHTML = "<strong>TRAINING SESSION · AI ENGINEERING</strong>";
const subtitle = document.createElement("p");
subtitle.textContent = data.subtitle;
const speaker = document.createElement("p");
speaker.textContent = data.presenter + " · " + data.presenterRole;
const provenance = document.createElement("p");
provenance.textContent =
  "18 slides · English · Supplied training notes. No session recording was provided; the YouTube player is an optional example.";
intro.append(lead, subtitle, speaker, provenance);
authored.append(intro);
for (const slide of data.slides) {
  const section = document.createElement("section");
  section.id = slide.id;
  section.dataset.melaSection = "";
  section.lang = "en";
  section.className = "mela-training-slide";
  const number = document.createElement("span");
  number.className = "mela-slide-number";
  number.textContent = String(slide.number).padStart(2, "0") + " / 18";
  const title = document.createElement("h2");
  title.textContent = slide.title;
  const content = document.createElement("div");
  content.dataset.melaContent = "";
  if (slide.number === 16) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Reveal the quiz answers";
    details.append(summary);
    for (const paragraph of slide.paragraphs) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      details.append(p);
    }
    content.append(details);
  } else
    for (const paragraph of slide.paragraphs) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      content.append(p);
    }
  section.append(number, title, content);
  authored.append(section);
}
const menu = document.querySelector("#curriculum_navigation_menu");
if (menu) {
  menu.replaceChildren();
  const heading = document.createElement("h2");
  heading.className = "fs-6 p-3";
  heading.textContent = "Training content";
  menu.append(heading);
  for (const slide of data.slides) {
    const link = document.createElement("a");
    link.href = "#" + slide.id;
    link.className = "list-group-item list-group-item-action";
    link.textContent = slide.number + ". " + slide.title;
    menu.append(link);
  }
}
await writeFile(
  "public/savanna/pages/offline-first-localized-ai.html",
  "<!doctype html>\n" + document.documentElement.outerHTML + "\n",
);

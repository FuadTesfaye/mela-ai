/** Additive integration on the upstream Savanna capture; host scripts remain intact. */
function mount() {
  const main = document.querySelector<HTMLElement>("main#content");
  if (!main) return;
  const concept = main.querySelector<HTMLElement>(
    "#curriculum_navigation_content",
  );
  const course =
    main
      .querySelector(".curriculum-switcher-label .fs-4")
      ?.textContent?.trim() || "Savanna course";
  main.dataset.melaContext = "";
  main.dataset.courseId = course.startsWith("WR") ? "wr-100" : "va-foundations";
  main.dataset.courseTitle = course;
  if (concept) {
    main.dataset.pageType = "lesson";
    main.dataset.lessonTitle =
      concept.querySelector("h1")?.textContent?.trim() || "Current lesson";
    main.dataset.moduleTitle = "VA Foundations & Professional Identity";
  } else main.dataset.pageType = "dashboard";
  for (const node of main.querySelectorAll<HTMLElement>(
    "[data-section-host],[data-track-host]",
  ))
    node.dataset.melaSection = "";
  document.body.classList.add("mela-savanna");
  const strip = document.createElement("div");
  strip.className = "mela-support-strip";
  strip.innerHTML =
    '<span class="mela-support-symbol" aria-hidden="true">✦</span><div><strong>MELA learning support</strong><span>Ask about this page · English course support · Human help</span></div><button type="button">Ask MELA ↗</button>';
  strip.querySelector("button")!.onclick = () =>
    window.dispatchEvent(new CustomEvent("mela:open"));
  const body =
    main.querySelector("#curriculum_navigation_content") ||
    main.querySelector("#layout-bars")?.nextElementSibling ||
    main;
  body.prepend(strip);
  if (concept) {
    const media = document.createElement("mela-course-media");
    media.setAttribute("lesson-id", "va-future");
    media.setAttribute("title", main.dataset.lessonTitle!);
    concept.querySelector("h1")?.after(media);
    const script = document.createElement("script");
    script.src = "/course-media.js";
    script.defer = true;
    document.body.append(script);
  }
  const assistant = document.createElement("db-assistant");
  assistant.setAttribute("lang", "en");
  assistant.setAttribute("api", "/api");
  assistant.setAttribute("content", "/content.json");
  assistant.setAttribute("mode", "docked");
  if (matchMedia("(min-width: 1200px)").matches)
    assistant.setAttribute("open", "");
  document.body.append(assistant);
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    "#sidebar a",
  )) {
    const text = link.textContent?.trim();
    if (text === "Home") link.href = "homepage-v1-self-paced.html";
    if (text === "Access my learning")
      link.href = "concept-with-navigation.html";
    if (text === "My courses") link.href = "homepage-v1-paced.html";
  }
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", mount, { once: true });
else mount();

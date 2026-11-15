/** Additive integration on the upstream Savanna capture; host scripts remain intact. */
function mount() {
  const main = document.querySelector<HTMLElement>("main#content");
  if (!main) return;
  const concept = main.querySelector<HTMLElement>(
    "#curriculum_navigation_content",
  );
  const course =
    main.dataset.courseTitle ||
    main
      .querySelector(".curriculum-switcher-label .fs-4")
      ?.textContent?.trim() ||
    "Savanna course";
  main.dataset.melaContext = "";
  main.dataset.courseId ||= course.startsWith("WR")
    ? "wr-100"
    : "va-foundations";
  main.dataset.courseTitle ||= course;
  if (concept) {
    main.dataset.pageType = "lesson";
    main.dataset.lessonTitle ||=
      concept.querySelector("h1")?.textContent?.trim() || "Current lesson";
    main.dataset.moduleTitle ||= "VA Foundations & Professional Identity";
  } else main.dataset.pageType = "dashboard";
  for (const node of main.querySelectorAll<HTMLElement>(
    "[data-section-host],#static-track-host",
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
    media.setAttribute("lesson-id", main.dataset.lessonId || "va-future");
    media.setAttribute("title", main.dataset.lessonTitle!);
    concept.querySelector("h1")?.after(media);
    const script = document.createElement("script");
    script.src = "/course-media.js";
    script.defer = true;
    document.body.append(script);
  }
  document.addEventListener("mela:transcript-ready", (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      target.tagName !== "MELA-COURSE-MEDIA" ||
      !main.contains(target)
    )
      return;
    const detail = (event as CustomEvent).detail;
    if (!detail || !Array.isArray(detail.cues) || detail.cues.length > 240)
      return;
    let video: URL;
    try {
      video = new URL(detail.videoUrl);
      if (
        video.origin !== "https://www.youtube.com" ||
        !/^[-_a-zA-Z0-9]{11}$/.test(video.searchParams.get("v") || "")
      )
        return;
    } catch {
      return;
    }
    main.querySelector("#mela-transcript-context")?.remove();
    const container = document.createElement("div");
    container.id = "mela-transcript-context";
    container.hidden = true;
    let text = "";
    let first = 0;
    let index = 0;
    const flush = () => {
      if (!text) return;
      const section = document.createElement("section");
      section.id = `video-${video.searchParams.get("v")}-${index++}`;
      section.dataset.melaSection = "";
      section.lang = "en";
      const source = new URL(video);
      source.searchParams.set("t", String(Math.floor(first)));
      section.dataset.melaSourceUrl = source.href;
      const title = document.createElement("h3");
      title.textContent = `English video transcript (AI-generated, unreviewed) · ${Math.floor(first / 60)}:${String(Math.floor(first % 60)).padStart(2, "0")}`;
      const content = document.createElement("p");
      content.dataset.melaContent = "";
      content.textContent = text;
      section.append(title, content);
      container.append(section);
      text = "";
    };
    for (const cue of detail.cues) {
      if (
        typeof cue.text !== "string" ||
        cue.text.length > 1500 ||
        typeof cue.start !== "number" ||
        !Number.isFinite(cue.start) ||
        cue.start < 0
      )
        return;
      if (text.length + cue.text.length > 5000) flush();
      if (!text) first = cue.start;
      text += cue.text + " ";
    }
    flush();
    main.append(container);
    window.dispatchEvent(new CustomEvent("mela:context-changed"));
  });
  const trainingLink = document.createElement("a");
  trainingLink.href = "offline-first-localized-ai.html";
  trainingLink.className = "mela-training-nav";
  trainingLink.textContent = "AI Engineering Training";
  const trainingItem = document.createElement("li");
  trainingItem.append(trainingLink);
  document.querySelector("#sidebar ul")?.append(trainingItem);
  if (!concept) {
    const card = document.createElement("a");
    card.href = "offline-first-localized-ai.html";
    card.className = "mela-training-card";
    const label = document.createElement("span");
    label.textContent = "TRAINING SESSION · AI ENGINEERING";
    const heading = document.createElement("strong");
    heading.textContent = "Offline-First & Localized AI";
    const description = document.createElement("span");
    description.textContent =
      "Kidus Yohannes · Senior ML Engineer · 18 slides + quiz";
    const action = document.createElement("b");
    action.textContent = "Open training →";
    card.append(label, heading, description, action);
    strip.after(card);
  }
  if ("serviceWorker" in navigator)
    void navigator.serviceWorker
      .getRegistration("/")
      .then((existing) => {
        if (
          !existing ||
          existing.active?.scriptURL === new URL("/sw.js", location.href).href
        )
          return navigator.serviceWorker.register("/sw.js");
      })
      .catch(() => {});
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

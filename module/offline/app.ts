import {
  downloadCourse,
  getSaved,
  listSaved,
  listDownloads,
  removeCourse,
  savedResourcesReady,
} from "./library";
import { groundedAnswer } from "../../lib/retrieval/search";
import { languages, type Language } from "../../lib/languages";
import { preparedTranslator } from "../../lib/localization/shared";
import type { RetrievalLocale } from "../../lib/retrieval/search";
let activeLocale: RetrievalLocale | undefined;
import type { CoursePack } from "../../lib/courses/catalogue";
const root = document.querySelector<HTMLElement>("#library")!;
const status = document.querySelector<HTMLElement>("#status")!;
const reader = document.querySelector<HTMLElement>("#reader")!;
const title = document.querySelector<HTMLElement>("#lesson-title")!;
const content = document.querySelector<HTMLElement>("#lesson-content")!;
const results = document.querySelector<HTMLElement>("#answer")!;
const form = document.querySelector<HTMLFormElement>("#question-form")!;
const language = document.querySelector<HTMLSelectElement>("#language")!;
let active: CoursePack | undefined;
const running = new Map<string, AbortController>();
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const e = document.createElement(tag);
  e.textContent = text;
  return e;
};
const followSource = (id: string) => {
  const target = document.getElementById(id);
  if (!target) return;
  let parent = target.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  target.focus();
  target.scrollIntoView({ block: "start" });
};
const say = (message: string) => {
  status.textContent = message;
};
const button = (text: string, run: () => unknown) => {
  const b = node("button", text);
  b.type = "button";
  b.onclick = () => {
    Promise.resolve()
      .then(run)
      .catch((e) => say(e instanceof Error ? e.message : "Please retry."));
  };
  return b;
};
async function openCourse(id: string) {
  const saved = await getSaved(id);
  if (!saved) throw new Error("Download this course first.");
  active = saved.pack;
  activeLocale = undefined;
  try {
    const cached = await caches.open(saved.cache);
    const response = await cached.match("/courses/" + active.id + ".am.json");
    if (response) {
      const pack = await response.json();
      if (Array.isArray(pack.entries))
        activeLocale = {
          translate: preparedTranslator(pack.entries),
          glossary: pack.glossary,
        };
    }
  } catch {}
  title.textContent = active.title;
  content.replaceChildren();
  results.replaceChildren();
  reader.hidden = false;
  for (const section of active.sections) {
    const article = node("section");
    article.id = section.id;
    article.dataset.sectionId = section.id;
    article.tabIndex = -1;
    article.append(node("h3", section.title), node("p", section.content));
    content.append(article);
  }
  const selected = active;
  const captions = node("details");
  captions.append(
    node(
      "summary",
      "Read saved video captions (video playback needs internet)",
    ),
  );
  const captionBody = node("div");
  captions.append(captionBody);
  captions.addEventListener("toggle", async () => {
    if (!captions.open || captionBody.childNodes.length) return;
    try {
      const cache = await caches.open(saved.cache);
      const response = await cache.match("/transcripts/9hE5-98ZeCg.json");
      if (!response) throw new Error("missing");
      const transcript = await response.json();
      captionBody.append(
        node("h4", transcript.title || "Selected public example video"),
        node(
          "p",
          "These captions belong to the selected public example video, not a recording of the training session.",
        ),
      );
      for (const cue of transcript.cues || [])
        captionBody.append(
          node(
            "p",
            Math.floor(cue.start / 60) +
              ":" +
              String(Math.floor(cue.start % 60)).padStart(2, "0") +
              " · " +
              cue.text,
          ),
        );
    } catch {
      captionBody.append(
        node("p", "Saved captions are unavailable. Retry the download online."),
      );
    }
  });
  content.append(captions);
  if (selected.practice.length) {
    const quiz = node("section");
    quiz.append(node("h3", "Check your understanding"));
    for (const q of selected.practice) {
      quiz.append(node("p", q.question));
      const feedback = node("p");
      feedback.setAttribute("role", "status");
      q.options.forEach((option, i) =>
        quiz.append(
          button(option, () => {
            feedback.textContent =
              (i === q.correct ? "Correct. " : "Try again. ") + q.rationale;
            const link = node("a", "Review lesson source");
            link.href = "#" + q.sourceId;
            link.onclick = () => followSource(q.sourceId);
            feedback.append(node("br"), link);
          }),
        ),
      );
      quiz.append(feedback);
    }
    content.append(quiz);
  }
  updateLessonLanguage();
  title.focus();
  say("Saved course opened. Answers use only this course.");
}
async function refresh() {
  root.replaceChildren();
  const saved = await listSaved();
  const states = await listDownloads();
  let available: Array<{
    id: string;
    title: string;
    bytes: number;
    revision: string;
  }> = [];
  try {
    const r = await fetch("/courses/index.json", {
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) available = await r.json();
  } catch {}
  const entries = new Map(available.map((c) => [c.id, c]));
  for (const c of saved)
    if (!entries.has(c.id))
      entries.set(c.id, {
        id: c.id,
        title: c.pack.title,
        bytes: 0,
        revision: c.pack.revision,
      });
  if (!entries.size)
    root.append(
      node(
        "p",
        "Connect once to see courses and download your first lesson pack.",
      ),
    );
  for (const course of entries.values()) {
    const card = node("article");
    card.className = "course";
    const existing = saved.find((s) => s.id === course.id);
    const state = states.find((s) => s.id === course.id);
    const resourcesReady = existing
      ? await savedResourcesReady(existing)
      : false;
    card.append(
      node("h2", course.title),
      node(
        "p",
        existing
          ? "Saved on " +
              new Date(existing.savedAt).toLocaleDateString() +
              ". " +
              (!resourcesReady
                ? "Saved text is available, but some resources were removed by the browser. Retry the download."
                : existing.pack.revision === course.revision
                  ? "Ready to read offline."
                  : "An updated course is available.")
          : "Public lesson text · " +
              Math.ceil(course.bytes / 1024) +
              " KB · videos stay online.",
      ),
    );
    if (existing)
      card.append(
        button("Open saved course", () => openCourse(course.id)),
        button("Remove download", async () => {
          if (running.has(course.id))
            throw new Error(
              "Cancel the current download before removing this course.",
            );
          if (confirm("Remove " + course.title + " from this device?")) {
            await removeCourse(course.id);
            if (active?.id === course.id) {
              active = undefined;
              activeLocale = undefined;
              reader.hidden = true;
              results.replaceChildren();
              content.replaceChildren();
            }
            await refresh();
          }
        }),
      );
    const progress = node(
      "p",
      state?.error || (running.has(course.id) ? "Download in progress…" : ""),
    );
    progress.setAttribute("role", "status");
    const download = button(
      existing
        ? "Update / verify download"
        : state
          ? "Retry / resume download"
          : "Download course",
      async () => {
        if (running.has(course.id)) return;
        const control = new AbortController();
        running.set(course.id, control);
        download.disabled = true;
        cancel.hidden = false;
        try {
          if ("serviceWorker" in navigator) {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () =>
                      reject(
                        new Error(
                          "Offline shell setup is still pending. Stay online and retry.",
                        ),
                      ),
                    30000,
                  );
                }),
              ]);
            } finally {
              clearTimeout(timer);
            }
          }
          await downloadCourse(course.id, control.signal, (s) => {
            progress.textContent =
              s.state === "ready"
                ? "Ready offline."
                : s.error ||
                  `Saving ${s.completed} of ${s.total} verified items…`;
          });
          say("Course downloaded. Open it to learn offline.");
        } finally {
          running.delete(course.id);
          cancel.hidden = true;
          await refresh();
        }
      },
    );
    const cancel = button("Cancel download", () =>
      running.get(course.id)?.abort(),
    );
    cancel.hidden = !running.has(course.id);
    download.disabled = running.has(course.id);
    card.append(download, cancel, progress);
    root.append(card);
  }
  document.querySelector("#network")!.textContent = navigator.onLine
    ? "Online · live help is available when the service is configured."
    : "Offline · saved courses and local search are available. Live help needs a connection.";
}
for (const [code, info] of Object.entries(languages)) {
  const option = node(
    "option",
    info.name + (info.status === "source-only" ? " · original source" : ""),
  );
  option.value = code;
  language.append(option);
}

function updateLessonLanguage() {
  if (!active) return;
  let translated = 0;
  for (const section of active.sections) {
    const element = document.getElementById(section.id);
    if (!element) continue;
    const translatedBody =
      language.value === "am"
        ? activeLocale?.translate(section.content)
        : undefined;
    const heading = element.querySelector("h3"),
      body = element.querySelector("p");
    if (heading)
      heading.textContent =
        language.value === "am"
          ? activeLocale?.translate(section.title) || section.title
          : section.title;
    if (body) {
      body.textContent = translatedBody || section.content;
      body.lang = translatedBody ? "am" : "en";
    }
    if (translatedBody) translated++;
  }
  if (language.value === "am")
    say(
      translated
        ? "Showing available Amharic AI drafts. Untranslated sections retain their English source."
        : "An Amharic lesson translation is not available in this course pack. Showing the English source.",
    );
  else if (language.value !== "en")
    say(
      "This language pack is not available yet. Showing the original source.",
    );
}
language.onchange = updateLessonLanguage;

form.onsubmit = (e) => {
  e.preventDefault();
  if (!active) return;
  const question = (
    document.querySelector("#question") as HTMLInputElement
  ).value.trim();
  if (!question) return;
  const answer = groundedAnswer(
    question,
    active.sections,
    { pageType: "lesson", courseId: active.id, sections: [] },
    language.value as Language,
    false,
    activeLocale,
  );
  results.lang = answer.language || "en";
  results.replaceChildren(
    node("h3", "From your saved course"),
    node("p", answer.answer),
  );
  if (answer.notice) results.append(node("p", answer.notice));
  for (const citation of answer.citations) {
    const a = node("a", citation.title);
    a.href = "#" + citation.id;
    a.onclick = () => followSource(citation.id);
    results.append(a, node("br"));
  }
  results.focus();
};
let promptEvent:
  | { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
  | undefined;
const install = document.querySelector<HTMLButtonElement>("#install")!;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  promptEvent = e as unknown as typeof promptEvent;
  install.hidden = false;
});
install.onclick = async () => {
  if (promptEvent) {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = undefined;
    install.hidden = true;
  }
};
window.addEventListener(
  "online",
  () => void refresh().catch((e) => say(e.message)),
);
window.addEventListener(
  "offline",
  () => void refresh().catch((e) => say(e.message)),
);
if ("serviceWorker" in navigator)
  void navigator.serviceWorker
    .register("/sw.js")
    .catch(() =>
      say(
        "Offline shell setup failed. Retry online before relying on offline launch.",
      ),
    );
void refresh().catch((e) => say(e.message));

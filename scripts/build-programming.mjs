import { readFile, writeFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
const selectedVideo = JSON.parse(
  await readFile("data/lesson-media.json", "utf8"),
);
const { document } = parseHTML(
  await readFile("public/savanna/pages/concept-with-navigation.html", "utf8"),
);
document.title = "Programming for Beginners | Savanna · MELA";
const main = document.querySelector("main#content");
Object.assign(main.dataset, {
  melaContext: "",
  courseId: "programming-for-beginners",
  courseTitle: "Programming · Beginner Learning",
  moduleTitle: "Learning to program",
  lessonTitle: "Programming for Beginners",
  lessonId: "programming-for-beginners",
});
main.querySelector(".curriculum-switcher-label .fs-4").textContent =
  "Programming · Beginner Learning";
const region = document.querySelector("#curriculum_navigation_content");
region.querySelector("h1").textContent = "Programming for Beginners";
const authored = region.querySelector(".savanna-styles");
authored.replaceChildren();
const intro = document.createElement("p");
intro.textContent =
  "Watch the video selected by your learning team, prepare its English transcript, and ask MELA to explain the lesson. The transcript is AI-generated and should be reviewed. No lesson contents are assumed before the video is processed.";
authored.append(intro);
const link = document.createElement("a");
link.href = selectedVideo.videoUrl;
link.target = "_blank";
link.rel = "noopener noreferrer";
link.textContent = "Open the selected video on YouTube";
authored.append(link);
const menu = document.querySelector("#curriculum_navigation_menu");
menu.replaceChildren();
const help = document.createElement("p");
help.className = "p-3";
help.textContent =
  "Use Explain this moment for the current timestamp, or ask about the whole video.";
menu.append(help);
await writeFile(
  "public/savanna/pages/programming-for-beginners.html",
  "<!doctype html>\n" + document.documentElement.outerHTML + "\n",
);

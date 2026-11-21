/** Voice access and learning navigation for blind and low-vision learners (English).
 *
 * Modes (remembered per device):
 *  - "voice": MELA speaks (text-to-speech) and reads lessons aloud.
 *  - "screen-reader": MELA never talks over TalkBack/NVDA/VoiceOver. It moves
 *    focus and announces through the screen reader (live regions) instead.
 *  - "off".
 * Entry: a first-visit choice bar (first thing a screen reader reaches),
 * Ctrl/⌘+Shift+M (talk), volume-up ×3 where the browser passes volume keys,
 * the installed app's "Talk to MELA" shortcut (?talk=1), or ?voice=1.
 * Browsers cannot tell a website that a screen reader is running, so two
 * activations without any mouse/touch press are treated as a screen-reader hint.
 *
 * Spoken or typed commands (handled before anything is sent to the AI):
 *  where am I · help · list lessons · next/previous lesson · open lesson 2 ·
 *  read the lesson · pause · resume · repeat · next/previous section ·
 *  slower · faster · stop · quiz me · explain that simply */
type Mode = "voice" | "screen-reader" | "off";
type Block = { el: HTMLElement; text: string; heading: boolean };
type Lesson = { id: string; title: string; source: string };
const STORAGE_KEY = "mela-voice-mode";
const NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
};

const scriptOrigin = (document.currentScript as HTMLScriptElement | null)?.src;
function install() {
  const w = window as unknown as { MelaVoiceAccess?: unknown };
  if (w.MelaVoiceAccess) return;
  let mode: Mode = "off";
  let lastPointer = 0;
  let pointerlessClicks = 0;
  const volumePresses: number[] = [];

  // ---------- output ----------
  const region = document.createElement("div");
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "assertive");
  region.style.cssText =
    "position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
  document.body.append(region);
  let rate = 1;
  let speaking = false;
  const voiceFor = () =>
    speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("en"));
  // MELA's voice: the server's natural voice (Groq → Gemini → eSpeak), with the
  // device's own voice as a fallback. Audio for upcoming text is prefetched.
  const ttsUrl = new URL("/api/v1/tts", scriptOrigin || location.href).href;
  const voiceCache = new Map<string, Promise<string | undefined>>();
  const fetchVoice = (text: string, language = "en") => {
    const cacheKey = language + ":" + text;
    let hit = voiceCache.get(cacheKey);
    if (!hit) {
      hit = fetch(ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 1000), language }),
      })
        .then((r) => (r.ok ? r.blob() : undefined))
        .then((b) => (b ? URL.createObjectURL(b) : undefined))
        .catch(() => undefined);
      voiceCache.set(cacheKey, hit);
      if (voiceCache.size > 60) {
        const [oldest, value] = voiceCache.entries().next().value!;
        voiceCache.delete(oldest);
        void value.then((u) => u && URL.revokeObjectURL(u));
      }
    }
    return hit;
  };
  const chunks = (text: string) => {
    const out: string[] = [];
    for (const sentence of text.match(/[^.!?።፧]+[.!?።፧]*\s*/g) || [text]) {
      if (out.length && out[out.length - 1].length + sentence.length < 400)
        out[out.length - 1] += sentence;
      else out.push(sentence);
    }
    return out.map((c) => c.trim()).filter(Boolean);
  };
  let player: HTMLAudioElement | undefined;
  let token = 0;
  const spokenLog: string[] = [];
  const deviceSay = (text: string, done: () => void) => {
    if (!("speechSynthesis" in window)) return done();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voiceFor();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = rate;
    utterance.onend = done;
    utterance.onerror = (e) => {
      if (e.error !== "interrupted" && e.error !== "canceled") done();
    };
    speechSynthesis.speak(utterance);
  };
  /** Play text out loud (no mode check); calls onDone when finished. */
  const speakOut = (text: string, onDone?: () => void, language = "en") => {
    quiet();
    const mine = ++token;
    speaking = true;
    spokenLog.push(text);
    if (spokenLog.length > 50) spokenLog.shift();
    const parts = chunks(text);
    const finish = () => {
      if (mine !== token) return;
      speaking = false;
      onDone?.();
    };
    const play = (i: number) => {
      if (mine !== token) return;
      if (i >= parts.length) return finish();
      if (parts[i + 1]) void fetchVoice(parts[i + 1], language);
      const next = () => play(i + 1);
      void fetchVoice(parts[i], language).then((url) => {
        if (mine !== token) return;
        // No server voice: the device voice only makes sense for English.
        if (!url)
          return language === "en"
            ? deviceSay(parts[i], () => mine === token && next())
            : next();
        const audio = new Audio(url);
        player = audio;
        audio.playbackRate = rate;
        audio.onended = () => mine === token && next();
        audio.onerror = () => mine === token && deviceSay(parts[i], next);
        // Blocked autoplay (no click yet on this page) → device voice.
        audio.play().catch(() => mine === token && deviceSay(parts[i], next));
      });
    };
    play(0);
  };
  /** Speak (talk mode) and always announce for screen readers. */
  const say = (text: string, onDone?: () => void) => {
    region.textContent = "";
    setTimeout(() => (region.textContent = text), 50);
    if (mode !== "voice") {
      onDone?.();
      return;
    }
    speakOut(text, onDone);
  };
  const quiet = () => {
    token++;
    speaking = false;
    player?.pause();
    player = undefined;
    speechSynthesis?.cancel();
  };

  // ---------- page model ----------
  const root = () =>
    document.querySelector<HTMLElement>("[data-mela-context]") ||
    document.querySelector<HTMLElement>("main,article,[role=main]") ||
    document.body;
  const skip =
    "nav,header,footer,form,script,style,template,[hidden],[aria-hidden=true],.modal,db-assistant,[data-mela-actions-ui],[data-mela-voice-ui],.sidebar";
  const blocks = (): Block[] => {
    const list: Block[] = [];
    for (const el of root().querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,p,li,blockquote,figcaption,dd,td",
    )) {
      if (el.closest(skip) || !el.getClientRects().length) continue;
      if (el.matches("li,td") && el.querySelector("p,li")) continue;
      const text = (el.innerText || el.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length < 2) continue;
      list.push({
        el,
        text: text.slice(0, 1500),
        heading: /^H[1-4]$/.test(el.tagName),
      });
    }
    return list;
  };
  const sectionStarts = (all: Block[]) =>
    all.map((b, i) => (b.heading ? i : -1)).filter((i) => i >= 0);
  let catalogue: Lesson[] | undefined;
  const lessons = async () => {
    if (catalogue) return catalogue;
    try {
      const response = await fetch("/courses/index.json");
      catalogue = ((await response.json()) as Lesson[]).filter((l) => l.source);
    } catch {
      catalogue = [];
    }
    return catalogue;
  };
  const currentLesson = async () => {
    const all = await lessons();
    const index = all.findIndex((l) => location.pathname === l.source);
    return { all, index };
  };
  const pageTitle = () =>
    root().dataset.lessonTitle ||
    document.querySelector("main h1, h1")?.textContent?.trim() ||
    document.title;

  // ---------- reader ----------
  let cursor = 0;
  let reading = false;
  let marked: HTMLElement | undefined;
  const mark = (el?: HTMLElement) => {
    if (marked) {
      marked.style.outline = marked.dataset.melaOutline || "";
      marked.style.backgroundColor = marked.dataset.melaBg || "";
    }
    marked = el;
    if (!el) return;
    el.dataset.melaOutline = el.style.outline;
    el.dataset.melaBg = el.style.backgroundColor;
    el.style.outline = "3px solid #d38b00";
    el.style.backgroundColor = "#fff4d6";
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const focus = (el: HTMLElement) => {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };
  const readFrom = (index: number) => {
    const all = blocks();
    if (!all.length) return say("I couldn't find lesson text on this page.");
    cursor = Math.max(0, Math.min(index, all.length - 1));
    const block = all[cursor];
    mark(block.el);
    if (mode === "screen-reader") {
      // Hand over to the screen reader: focus the text, it reads from there.
      reading = false;
      focus(block.el);
      return;
    }
    reading = true;
    if (all[cursor + 1]) void fetchVoice(chunks(all[cursor + 1].text)[0] || "");
    say(block.text, () => {
      if (!reading) return;
      if (cursor + 1 < all.length) readFrom(cursor + 1);
      else {
        reading = false;
        mark();
        say("End of the lesson. Say next lesson, or quiz me.");
      }
    });
  };
  const jumpSection = (step: 1 | -1) => {
    const all = blocks();
    const starts = sectionStarts(all);
    if (!starts.length) return readFrom(cursor + step);
    const target =
      step > 0
        ? starts.find((i) => i > cursor)
        : [...starts].reverse().find((i) => i < cursor);
    if (target === undefined)
      return say(
        step > 0 ? "This is the last section." : "This is the first section.",
      );
    if (mode === "screen-reader") {
      cursor = target;
      mark(all[target].el);
      focus(all[target].el);
      return say(`Section: ${all[target].text}`);
    }
    readFrom(target);
  };

  // ---------- commands ----------
  let quiz: string | undefined;
  let awaitingQuiz = false;
  addEventListener("mela:answer", (e) => {
    if (awaitingQuiz) {
      quiz = String((e as CustomEvent).detail || "");
      awaitingQuiz = false;
    }
  });
  const help =
    "You can say: where am I, read the lesson, pause, resume, repeat, next section, slower, faster, list lessons, next lesson, open lesson 2, quiz me, or explain that simply. Or just ask any question.";
  const go = async (lesson: Lesson | undefined, label: string) => {
    if (!lesson) return say(`There is no ${label} lesson.`);
    try {
      sessionStorage.setItem("mela-arrived", "1");
    } catch {}
    say(`Opening ${lesson.title}.`);
    setTimeout(() => (location.href = lesson.source), 900);
  };
  const whereAmI = async () => {
    const { all, index } = await currentLesson();
    const b = blocks();
    const starts = sectionStarts(b);
    const section = [...starts].reverse().find((i) => i <= cursor);
    const parts = [
      index >= 0
        ? `You are on lesson ${index + 1} of ${all.length}: ${all[index].title}.`
        : `You are on ${pageTitle()}.`,
      starts.length ? `It has ${starts.length} sections.` : "",
      section !== undefined && cursor > 0
        ? `You are at: ${b[section].text}.`
        : "",
      "Say read the lesson to start, or help for more.",
    ];
    return parts.filter(Boolean).join(" ");
  };
  /** Returns a reply to show/say, true if handled silently, or a rewritten AI question. */
  const handle = async (
    raw: string,
  ): Promise<
    { reply?: string; rewrite?: string; silent?: boolean } | undefined
  > => {
    const text = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const is = (re: RegExp) => re.test(text);
    if (awaitingQuiz === false && quiz && !is(/^(stop|quiz me|help)$/)) {
      const question = quiz;
      quiz = undefined;
      return {
        rewrite: `You asked me this quiz question: "${question}". My answer is: "${raw}". Tell me kindly if I am right, and explain the correct answer in one or two short sentences.`,
      };
    }
    if (is(/^(where am i|what page is this|where are we)$/))
      return { reply: await whereAmI() };
    if (is(/^(help|what can i say|commands|what can you do)$/))
      return { reply: help };
    if (is(/^(list|show|read)( the| all)? (lessons|courses)$|^what lessons/)) {
      const all = await lessons();
      if (!all.length) return { reply: "I couldn't load the lesson list." };
      return {
        reply:
          `There are ${all.length} lessons. ` +
          all.map((l, i) => `Lesson ${i + 1}: ${l.title}.`).join(" ") +
          " Say open lesson and a number.",
      };
    }
    if (is(/^(go to |open )?(the )?next (lesson|course)$/)) {
      const { all, index } = await currentLesson();
      await go(all[index + 1] || (index < 0 ? all[0] : undefined), "next");
      return { reply: "" };
    }
    if (
      is(
        /^(go to |open )?(the )?(previous|last) (lesson|course)$|^go back a lesson$/,
      )
    ) {
      const { all, index } = await currentLesson();
      await go(index > 0 ? all[index - 1] : undefined, "previous");
      return { reply: "" };
    }
    const open =
      /^(open|go to|start)? ?(lesson|course) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth)$/.exec(
        text,
      );
    if (open) {
      const n = Number(open[3]) || NUMBERS[open[3]];
      const all = await lessons();
      if (!n || !all[n - 1])
        return {
          reply: `There is no lesson ${open[3]}. There are ${all.length} lessons.`,
        };
      await go(all[n - 1], "that");
      return { reply: "" };
    }
    if (
      is(
        /^(read|start reading|read (the |this )?(lesson|page)( to me)?|read (it |from )?(from )?(the )?(start|beginning))$/,
      )
    ) {
      const intro =
        mode === "screen-reader"
          ? "Moved to the start of the lesson. Your screen reader will read from here."
          : `Reading ${pageTitle()}.`;
      // Say the intro first, then read (speaking the reply would cut the reading off).
      if (mode === "screen-reader") readFrom(0);
      else say(intro, () => readFrom(0));
      return { reply: intro, silent: true };
    }
    if (is(/^(pause|stop reading|hold on|wait)$/)) {
      reading = false;
      quiet();
      return { reply: "Paused. Say resume to continue." };
    }
    if (is(/^(resume|continue|keep reading|go on|carry on)$/)) {
      readFrom(cursor);
      return { reply: "" };
    }
    if (is(/^(repeat|repeat that|say that again|again|what did you say)$/)) {
      readFrom(cursor);
      return { reply: "" };
    }
    if (is(/^(next section|skip|skip section|next part|next)$/)) {
      jumpSection(1);
      return { reply: "" };
    }
    if (is(/^(previous section|go back|back|previous part|previous)$/)) {
      jumpSection(-1);
      return { reply: "" };
    }
    if (is(/^(read )?(slower|slow down|more slowly)$/)) {
      rate = Math.max(0.6, rate - 0.2);
      if (reading) readFrom(cursor);
      return { reply: reading ? "" : "I'll read slower." };
    }
    if (is(/^(read )?(faster|speed up|quicker)$/)) {
      rate = Math.min(1.8, rate + 0.2);
      if (reading) readFrom(cursor);
      return { reply: reading ? "" : "I'll read faster." };
    }
    if (is(/^(stop|stop talking|be quiet|quiet|cancel)$/)) {
      reading = false;
      quiet();
      mark();
      return { reply: "Stopped." };
    }
    if (is(/^(quiz me|test me|ask me a question|give me a quiz)$/)) {
      awaitingQuiz = true;
      return {
        rewrite:
          "Quiz me: ask me ONE short question about this lesson that I can answer in a few words. Ask only the question and do not give the answer.",
      };
    }
    if (
      is(
        /^explain (that|this|it)( simply| again| more simply)?$|^explain simply$|^i don't understand$/,
      )
    ) {
      const all = blocks();
      const current = all[cursor]?.text || pageTitle();
      return {
        rewrite: `Explain this part of the lesson simply, in two or three short sentences, for a beginner: "${current.slice(0, 700)}"`,
      };
    }
    return undefined;
  };

  // The widget dispatches "mela:heard" before sending a question to the AI.
  addEventListener("mela:heard", (e) => {
    const event = e as CustomEvent<{
      text: string;
      reply: (t: string) => void;
    }>;
    const text = event.detail.text;
    // Decide synchronously whether this is a command (so the widget can stop).
    const probe = text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const command =
      (quiz && !awaitingQuiz) ||
      /^(where am i|what page is this|where are we|help|what can i say|commands|what can you do|list( the| all)? (lessons|courses)|show( the| all)? (lessons|courses)|read( the| all)? (lessons|courses)|what lessons.*|(go to |open )?(the )?(next|previous|last) (lesson|course)|go back a lesson|(open|go to|start)? ?(lesson|course) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth)|read|start reading|read (the |this )?(lesson|page)( to me)?|read (it |from )?(from )?(the )?(start|beginning)|pause|stop reading|hold on|wait|resume|continue|keep reading|go on|carry on|repeat|repeat that|say that again|again|what did you say|next section|skip|skip section|next part|next|previous section|go back|back|previous part|previous|(read )?(slower|slow down|more slowly|faster|speed up|quicker)|stop|stop talking|be quiet|quiet|cancel|quiz me|test me|ask me a question|give me a quiz|explain (that|this|it)( simply| again| more simply)?|explain simply|i don't understand)$/.test(
        probe,
      );
    if (!command) return;
    const rewriteOnly =
      /^(quiz me|test me|ask me a question|give me a quiz|explain (that|this|it)( simply| again| more simply)?|explain simply|i don't understand)$/.test(
        probe,
      ) ||
      (quiz && !awaitingQuiz);
    if (rewriteOnly) {
      // Rewrites are synchronous so the widget sends the new question.
      if (/^(quiz me|test me|ask me a question|give me a quiz)$/.test(probe)) {
        awaitingQuiz = true;
        event.detail.text =
          "Quiz me: ask me ONE short question about this lesson that I can answer in a few words. Ask only the question and do not give the answer.";
      } else if (quiz && !awaitingQuiz) {
        event.detail.text = `You asked me this quiz question: "${quiz}". My answer is: "${text}". Tell me kindly if I am right, and explain the correct answer in one or two short sentences.`;
        quiz = undefined;
      } else {
        const current = blocks()[cursor]?.text || pageTitle();
        event.detail.text = `Explain this part of the lesson simply, in two or three short sentences, for a beginner: "${current.slice(0, 700)}"`;
      }
      return;
    }
    event.preventDefault();
    void handle(text).then((result) => {
      if (result?.reply) {
        event.detail.reply(result.reply);
        if (!result.silent) say(result.reply);
      }
    });
  });

  // ---------- modes ----------
  const setMode = (next: Mode, announce: boolean) => {
    if (mode === next) return;
    mode = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    bar?.remove();
    window.dispatchEvent(
      new CustomEvent("mela:voice-mode", {
        detail: next === "off" ? false : next,
      }),
    );
    if (!announce) return;
    const key = /Mac|iPhone|iPad/.test(navigator.platform)
      ? "Command Shift M"
      : "Control Shift M";
    if (next === "voice")
      say(
        `MELA will talk to you. Press ${key} any time and speak. Say help to hear what you can say.`,
      );
    if (next === "screen-reader")
      say(
        `Screen reader mode. MELA won't talk over your screen reader. Press ${key} and speak to navigate, for example: where am I, or read the lesson.`,
      );
  };
  const talk = () => {
    if (mode === "off") setMode("voice", false);
    reading = false;
    quiet();
    window.dispatchEvent(new CustomEvent("mela:talk"));
  };

  // First-visit choice bar: first element a screen reader reaches.
  let bar: HTMLElement | undefined;
  const offerChoice = () => {
    bar = document.createElement("section");
    bar.setAttribute("data-mela-voice-ui", "");
    bar.setAttribute("aria-label", "MELA accessibility");
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:2147483646;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;padding:8px 12px;background:#103c4b;color:#fff;font:16px/1.4 system-ui,sans-serif;box-shadow:0 2px 10px #0004";
    const label = document.createElement("span");
    label.textContent = "Would you like MELA to help you by voice?";
    const button = (text: string, next: Mode) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.style.cssText =
        "font:inherit;font-weight:600;padding:8px 14px;border-radius:8px;border:2px solid #fff;background:" +
        (next === "voice" ? "#fff;color:#103c4b" : "transparent;color:#fff") +
        ";cursor:pointer";
      b.onclick = () => setMode(next, true);
      return b;
    };
    bar.append(
      label,
      button("Yes, talk to me", "voice"),
      button("I use a screen reader", "screen-reader"),
      button("No thanks", "off"),
    );
    document.body.prepend(bar);
  };

  // ---------- triggers ----------
  addEventListener(
    "keydown",
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyM") {
        e.preventDefault();
        e.stopPropagation();
        talk();
        return;
      }
      if (e.key === "Escape") {
        reading = false;
        quiet();
      }
      if (e.key === "AudioVolumeUp" || e.key === "VolumeUp") {
        const now = Date.now();
        volumePresses.push(now);
        while (volumePresses.length && now - volumePresses[0] > 2000)
          volumePresses.shift();
        if (volumePresses.length >= 3) {
          volumePresses.length = 0;
          talk();
        }
      }
    },
    true,
  );
  const pressed = () => (lastPointer = Date.now());
  addEventListener("pointerdown", pressed, true);
  addEventListener("touchstart", pressed, { capture: true, passive: true });
  addEventListener("mousedown", pressed, true);
  addEventListener(
    "click",
    (e) => {
      if (!e.isTrusted || mode !== "off" || stored) return;
      if ((e.target as HTMLElement)?.closest?.("[data-mela-voice-ui]")) return;
      if (Date.now() - lastPointer < 1500) return;
      if (++pointerlessClicks >= 2) setMode("screen-reader", true);
    },
    true,
  );

  // ---------- start ----------
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {}
  if (stored === "1") stored = "voice";
  const params = new URLSearchParams(location.search);
  if (stored === "voice" || stored === "screen-reader") setMode(stored, false);
  else if (params.has("voice")) setMode("voice", false);
  else if (!stored) offerChoice();
  if (params.get("talk") === "1") setTimeout(talk, 800);
  let arrived = false;
  try {
    arrived = sessionStorage.getItem("mela-arrived") === "1";
    sessionStorage.removeItem("mela-arrived");
  } catch {}
  if (arrived && mode !== "off")
    setTimeout(() => void whereAmI().then((t) => say(t)), 1200);

  w.MelaVoiceAccess = {
    talk,
    setMode: (next: Mode) => setMode(next, true),
    command: async (text: string) => (await handle(text))?.reply,
    /** Speak with MELA's voice (used by the chat's Listen button and answers). */
    speak: (text: string, language = "en") =>
      speakOut(text, undefined, language),
    stop: quiet,
    spoken: () => [...spokenLog],
    get mode() {
      return mode;
    },
    get voiceMode() {
      return mode !== "off";
    },
  };
}
if (document.body) install();
else addEventListener("DOMContentLoaded", install);

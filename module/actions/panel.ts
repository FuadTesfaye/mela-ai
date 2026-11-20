import { createActionEngine, parseAction, type ActionResult } from "./engine";
import { create as createVoice } from "../voice/input";
import { isLanguage, languages, type Language } from "../../lib/languages";
export function mountActions(
  options: {
    root?: ParentNode;
    api?: string;
    container?: HTMLElement;
    language?: Language;
    shadowMode?: ShadowRootMode;
    extraControls?: HTMLElement;
    question?: (question: string) => Promise<ActionResult>;
  } = {},
) {
  const container = options.container || document.body;
  const host = document.createElement("section");
  host.dataset.melaActionsUi = "";
  host.setAttribute("aria-label", "MELA web voice assistant");
  const shadow = host.attachShadow({ mode: options.shadowMode || "open" });
  const style = document.createElement("style");
  style.textContent =
    ":host{display:block;position:fixed;bottom:18px;right:18px;z-index:2147483647;width:min(420px,calc(100vw - 36px));font:16px/1.5 system-ui;color:#17394e}details{max-height:calc(100dvh - 48px);overflow:auto;background:#fff;border:2px solid #087e8b;border-radius:14px;box-shadow:0 8px 40px #103c4b33;padding:14px}summary{cursor:pointer;font-weight:bold;min-height:44px}button,textarea,select{font:inherit;margin:6px 4px 6px 0;padding:9px;min-height:44px;border:2px solid #526e78;border-radius:6px}button{cursor:pointer;background:#103c4b;color:white}textarea{box-sizing:border-box;width:100%;color:#17394e;background:white}*:focus-visible{outline:3px solid #b46d05;outline-offset:3px}[role=status]{max-height:220px;overflow:auto;white-space:pre-wrap}label{display:block}";
  shadow.append(style);
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "MELA · Talk to this website";
  details.append(summary);
  const help = document.createElement("p");
  help.textContent =
    "Try “read page”, “scroll down”, “find Downloads”, “click Next” or “fill Name with …”. Actions use this page only." +
    (options.question
      ? " Ask a question here to search the page and remembered site context."
      : "");
  const input = document.createElement("textarea");
  input.maxLength = 2000;
  input.rows = 2;
  input.setAttribute("aria-label", "Web command");
  const output = document.createElement("div");
  output.tabIndex = 0;
  output.setAttribute("aria-label", "Web command result");
  output.setAttribute("role", "status");
  output.setAttribute("aria-live", "polite");
  const controls = document.createElement("div");
  const confirm = document.createElement("div");
  const engine = createActionEngine(options.root || document);
  let language = options.language || "en";
  let request = 0,
    disposed = false;
  const b = (label: string, fn: () => unknown) => {
    const e = document.createElement("button");
    e.type = "button";
    e.textContent = label;
    e.onclick = () => {
      try {
        Promise.resolve(fn()).catch(() => {
          if (!disposed)
            output.textContent = "The action is unavailable. Please try again.";
        });
      } catch {
        output.textContent =
          "The page changed or the action is unavailable. Please try again.";
      }
    };
    return e;
  };
  const show = (result: ActionResult) => {
    output.textContent = result.message;
    if (result.sources?.length) {
      const list = document.createElement("ul");
      for (const source of result.sources) {
        try {
          const url = new URL(source.url);
          if (!["http:", "https:"].includes(url.protocol)) continue;
          const item = document.createElement("li"),
            link = document.createElement("a");
          link.textContent = source.title;
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          item.append(link);
          list.append(item);
        } catch {}
      }
      output.append(list);
    }
    confirm.replaceChildren();
    if (result.status === "confirm")
      confirm.append(
        b("Confirm action", () => show(engine.confirm())),
        b("Cancel action", () => {
          engine.cancel();
          confirm.replaceChildren();
          output.textContent = "Cancelled.";
        }),
      );
    if (result.choices)
      for (const choice of result.choices)
        confirm.append(b(choice.name, () => show(engine.choose(choice.id))));
  };
  const run = async () => {
    const id = ++request;
    const text = input.value.trim();
    const action = parseAction(text);
    if (action) {
      show(engine.execute(action));
      return;
    }
    engine.cancel();
    confirm.replaceChildren();
    if (options.question && text) {
      output.textContent = "Searching this page and saved site context…";
      try {
        const answer = await options.question(text);
        if (!disposed && id === request) show(answer);
      } catch {
        if (!disposed && id === request)
          output.textContent =
            "Saved context is unavailable. Try a current-page command.";
      }
      return;
    }
    output.textContent =
      "Command not recognised. Try one of the examples above.";
  };

  const locale = document.createElement("select");
  locale.setAttribute("aria-label", "Command language");
  for (const [code, info] of Object.entries(languages)) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = info.name;
    locale.append(option);
  }
  locale.value = language;
  locale.onchange = () => {
    request++;
    voice.cancel();
    engine.cancel();
    confirm.replaceChildren();
    language = isLanguage(locale.value) ? locale.value : "en";
  };
  const mic = b("Use microphone", () => voice.toggle());
  const voice = createVoice({
    input,
    button: mic,
    language: () => language,
    status: (message) => {
      output.textContent = message;
    },
    api: options.api || new URL("/api/v1", location.href).href,
  });
  controls.append(
    b("Run command", run),
    mic,
    b("Stop", () => {
      request++;
      voice.cancel();
      engine.cancel();
      confirm.replaceChildren();
      output.textContent = "Stopped. Pending actions cancelled.";
    }),
  );
  controls.append(
    b("Listen to result", () => {
      const text = output.textContent || "";
      if (!text || !("speechSynthesis" in window)) return;
      const sourceLanguage =
        document.documentElement.lang.split("-")[0] || "en";
      const matching = window.speechSynthesis
        .getVoices()
        .find((v) =>
          v.lang.toLowerCase().startsWith(sourceLanguage.toLowerCase()),
        );
      if (!matching) {
        output.textContent =
          "No matching device voice is available. Please read the result.";
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 2000));
      utterance.voice = matching;
      window.speechSynthesis.speak(utterance);
    }),
  );
  details.append(help, locale, input, controls, output, confirm);
  if (options.extraControls) details.append(options.extraControls);
  shadow.append(details);
  container.append(host);
  const cancel = () => {
    request++;
    voice.cancel();
    engine.cancel();
    confirm.replaceChildren();
  };
  const close = () => {
    if (!details.open) {
      voice.cancel();
      cancel();
    }
  };
  details.addEventListener("toggle", close);
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      details.open = false;
      cancel();
      summary.focus();
    }
  };
  host.addEventListener("keydown", key);
  return {
    element: host,
    setLanguage(value: Language) {
      if (isLanguage(value)) {
        request++;
        voice.cancel();
        engine.cancel();
        confirm.replaceChildren();
        language = value;
        locale.value = value;
      }
    },
    destroy() {
      disposed = true;
      request++;
      voice.stop();
      engine.cancel();
      host.remove();
    },
    open() {
      details.open = true;
      input.focus();
    },
  };
}

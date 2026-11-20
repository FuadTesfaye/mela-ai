export type PageAction = {
  kind:
    | "read"
    | "explain"
    | "scroll"
    | "back"
    | "focus"
    | "activate"
    | "fill"
    | "media"
    | "stop";
  target?: string;
  value?: string;
};
export type ActionResult = {
  status: "done" | "choose" | "confirm" | "unsupported";
  message: string;
  choices?: { id: number; name: string }[];
};
export function parseAction(raw: string): PageAction | undefined {
  const text = raw.trim().replace(/[.!?።]+$/u, "");
  if (/^(stop|cancel|አቁም|ሰርዝ)$/iu.test(text)) return { kind: "stop" };
  if (
    /^(read (this )?(page|lesson)|read aloud|ገጹን አንብብ|ትምህርቱን አንብብ)$/iu.test(
      text,
    )
  )
    return { kind: "read" };
  if (/^(explain (this )?(page|selection)|አብራራ)$/iu.test(text))
    return {
      kind: "explain",
      target: /selection/iu.test(text) ? "selection" : "page",
    };
  if (/^(go back|back|ተመለስ)$/iu.test(text)) return { kind: "back" };
  if (/^(scroll |ወደ )?(down|up|top|bottom|ታች|ላይ)$/iu.test(text))
    return { kind: "scroll", value: /up|top|ላይ/iu.test(text) ? "up" : "down" };
  const target = /^(open|click|focus|find|ክፈት|ጫን|ፈልግ)\s+(.+)$/iu.exec(text);
  if (target)
    return {
      kind: /focus|find|ፈልግ/iu.test(target[1]) ? "focus" : "activate",
      target: target[2],
    };
  const fill = /^(?:fill|type)\s+(.+?)\s+(?:with|as)\s+(.+)$/iu.exec(text);
  if (fill) return { kind: "fill", target: fill[1], value: fill[2] };
  const media = /^(play|pause|resume)(?: (?:video|lesson|audio))?$/iu.exec(
    text,
  );
  if (media)
    return { kind: "media", value: media[1] === "pause" ? "pause" : "play" };
}
const privateSelector =
  '[data-private],form,script,style,nav,template,[hidden],[inert],[aria-hidden="true"],input,textarea,select,[contenteditable], [data-mela-actions-ui]';
export function readablePage(root: ParentNode = document): string {
  const source =
    root instanceof Element && root.matches("[data-mela-context],main,article")
      ? root
      : root.querySelector("[data-mela-context],main,article");
  if (!source) return "";
  if (source.closest("[data-private],[hidden]")) return "";
  const copy = source.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(privateSelector).forEach((n) => n.remove());
  return (copy.textContent || "").replace(/\s+/g, " ").trim().slice(0, 12000);
}
function name(element: HTMLElement): string {
  const labelled = element.getAttribute("aria-labelledby");
  if (labelled) {
    const label = labelled
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
    if (label) return label;
  }
  return (
    element.getAttribute("aria-label")?.trim() ||
    (element instanceof HTMLInputElement
      ? element.labels?.[0]?.textContent?.trim()
      : undefined) ||
    element.textContent?.trim() ||
    element.getAttribute("title") ||
    ""
  );
}
function visible(element: HTMLElement) {
  return (
    !element.closest(
      '[hidden],[inert],[aria-hidden="true"],[data-private],[data-mela-actions-ui]',
    ) &&
    !element.matches(":disabled") &&
    getComputedStyle(element).visibility !== "hidden" &&
    getComputedStyle(element).display !== "none" &&
    element.getClientRects().length > 0
  );
}
function sensitive(element: HTMLElement) {
  return (
    element.matches(
      'input[type="password"],input[type="file"],input[type="hidden"],input[type="submit"],input[type="button"],input[type="checkbox"],input[type="radio"]',
    ) ||
    /password|credit|card number|cvv|otp|one.time|verification|security.code|cc-|current-password|new-password/i.test(
      [
        name(element),
        element.getAttribute("autocomplete"),
        element.getAttribute("name"),
        element.id,
      ].join(" "),
    )
  );
}
export function createActionEngine(root: ParentNode = document) {
  let pending:
    | {
        action: PageAction;
        element: HTMLElement;
        url: string;
        label: string;
        fingerprint: string;
      }
    | undefined;
  let choices: HTMLElement[] = [];
  let choosing: PageAction | undefined;
  const reset = () => {
    pending = undefined;
    choices = [];
    choosing = undefined;
  };
  const perform = (
    action: PageAction,
    element: HTMLElement,
    confirmed = false,
  ): ActionResult => {
    if (!element.isConnected || !visible(element))
      return {
        status: "unsupported",
        message: "That control is no longer available. Please ask again.",
      };
    if (action.kind === "fill") {
      if (
        !(
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement
        ) ||
        sensitive(element)
      )
        return {
          status: "unsupported",
          message:
            "This field cannot be filled by MELA. Use the website directly.",
        };
      if (!confirmed) {
        pending = {
          action,
          element,
          url: location.href,
          label: name(element),
          fingerprint: element.outerHTML,
        };
        return {
          status: "confirm",
          message: `Fill “${name(element)}” with “${action.value}”?`,
        };
      }
      const setter = Object.getOwnPropertyDescriptor(
        element instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(
        element,
        (action.value || "").slice(
          0,
          Math.min(element.maxLength > 0 ? element.maxLength : 2000, 2000),
        ),
      );
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (action.kind === "focus") {
      element.focus();
      element.scrollIntoView({ block: "center" });
    } else {
      const link = element.closest("a[href]") as HTMLAnchorElement | null;
      if (
        link &&
        !["https:", "http:"].includes(
          new URL(link.href, location.href).protocol,
        )
      )
        return {
          status: "unsupported",
          message: "Only ordinary web links can be opened.",
        };
      // All activations are confirmed: a button's side effects cannot be inferred from its label.
      if (!confirmed) {
        pending = {
          action,
          element,
          url: location.href,
          label: name(element),
          fingerprint: element.outerHTML,
        };
        return {
          status: "confirm",
          message: `Activate “${name(element)}”? Review the website before continuing.`,
        };
      }
      element.click();
    }
    return {
      status: "done",
      message: `${action.kind === "fill" ? "Filled" : action.kind === "focus" ? "Focused" : "Activated"} “${name(element)}”.`,
    };
  };
  return {
    cancel() {
      reset();
      window.speechSynthesis?.cancel();
    },
    confirm(): ActionResult {
      const p = pending;
      pending = undefined;
      if (
        !p ||
        p.url !== location.href ||
        p.label !== name(p.element) ||
        p.fingerprint !== p.element.outerHTML ||
        !p.element.isConnected
      )
        return {
          status: "unsupported",
          message: "The page or target changed. Please ask again.",
        };
      return perform(p.action, p.element, true);
    },
    choose(id: number): ActionResult {
      const element = choices[id];
      const action = choosing;
      choices = [];
      choosing = undefined;
      if (!element || !action)
        return {
          status: "unsupported",
          message: "Choose a current matching control.",
        };
      return perform(action, element);
    },
    execute(action: PageAction): ActionResult {
      reset();
      if (action.kind === "stop") {
        window.speechSynthesis?.cancel();
        return {
          status: "done",
          message: "Stopped. Pending actions cancelled.",
        };
      }
      if (action.kind === "read" || action.kind === "explain") {
        let text = readablePage(root);
        if (action.kind === "explain" && action.target === "selection") {
          const selection = window.getSelection();
          const range = selection?.rangeCount
            ? selection.getRangeAt(0)
            : undefined;
          const ancestor = (node: Node | undefined) =>
            node?.nodeType === 1 ? (node as Element) : node?.parentElement;
          const start = ancestor(range?.startContainer),
            end = ancestor(range?.endContainer);
          const permitted = (element: Element | undefined | null) =>
            !!element &&
            !element.closest(privateSelector) &&
            (root instanceof Element
              ? root.contains(element)
              : root === document || (root as Document).contains(element));
          text = "";
          if (range && permitted(start) && permitted(end)) {
            const copy = range.cloneContents();
            copy
              .querySelectorAll(privateSelector)
              .forEach((node) => node.remove());
            text = (copy.textContent || "").trim().slice(0, 12000);
          }
          if (!text)
            return {
              status: "unsupported",
              message:
                "Select public lesson text first. Form fields and private regions are excluded.",
            };
        }
        if (action.kind === "explain")
          return {
            status: "done",
            message: text
              ? `Page source (source text, not a generated explanation): ${text}`
              : "No approved readable page content was found.",
          };
        return {
          status: "done",
          message: text || "No readable lesson content was found.",
        };
      }
      if (action.kind === "scroll") {
        window.scrollBy({
          top: (action.value === "up" ? -1 : 1) * innerHeight * 0.7,
          behavior: "instant",
        });
        return { status: "done", message: "Scrolled " + action.value + "." };
      }
      if (action.kind === "back") {
        history.back();
        return { status: "done", message: "Going back." };
      }
      if (action.kind === "media") {
        const videos = Array.from(
          root.querySelectorAll<HTMLMediaElement>("video,audio"),
        ).filter(visible);
        if (videos.length !== 1)
          return {
            status: "unsupported",
            message:
              "Use the player controls, or ask when one supported video or audio player is visible.",
          };
        if (action.value === "pause") videos[0].pause();
        else void videos[0].play().catch(() => {});
        return {
          status: "done",
          message:
            action.value === "pause"
              ? "Paused playback."
              : "Requested playback. If blocked, use the player’s Play button.",
        };
      }
      const target = (action.target || "").toLocaleLowerCase().trim();
      if (!target)
        return {
          status: "unsupported",
          message: "Name the control you want to use.",
        };
      const selector =
        action.kind === "fill"
          ? "input,textarea"
          : 'a[href],button,input,textarea,select,[tabindex],[role="button"],[role="link"]';
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(selector),
      ).filter((e) => visible(e) && !sensitive(e));
      const exact = candidates.filter(
        (e) => name(e).toLocaleLowerCase() === target,
      );
      const matches = exact.length
        ? exact
        : candidates.filter((e) =>
            name(e).toLocaleLowerCase().includes(target),
          );
      if (!matches.length)
        return {
          status: "unsupported",
          message: `No visible control named “${action.target}” was found. Try its exact label.`,
        };
      if (matches.length > 1) {
        choices = matches.slice(0, 10);
        choosing = action;
        return {
          status: "choose",
          message: "Choose the control you meant.",
          choices: choices.map((e, id) => ({ id, name: name(e) })),
        };
      }
      return perform(action, matches[0]);
    },
  };
}

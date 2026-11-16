# MELA SDK

A framework-independent Web Component SDK with an optional React adapter and an iframe wrapper. The website hosting it may use PHP, Django, Rails, React, WordPress, static HTML, or another stack. MELA's API runs separately.

## Build and install

From the repository root:

```sh
npm ci
npm run widget:build
npm pack ./packages/sdk --pack-destination /tmp
```

Install the resulting local tarball in a React application, or use the hosted script/ES module directly. No npm publication is required. The core SDK has no React dependency; React is an optional peer only for the React adapter.

## One script and HTML components

```html
<script src="https://mela.example/mela-sdk.js" defer></script>
<main data-mela-context>
  <mela-course-media
    api="https://mela.example/api"
    video-src="https://www.youtube.com/watch?v=9hE5-98ZeCg"
    lesson-id="va-future"
  >
  </mela-course-media>
  <db-assistant
    api="https://mela.example/api"
    content="https://mela.example/content.json"
    lang="en"
  >
  </db-assistant>
</main>
```

Both components isolate their internal styles using Shadow DOM. YouTube is loaded only after the user selects Load YouTube video or a host explicitly calls `setVideo`. Set the backend's `ALLOWED_ORIGINS` to include the host website's exact origin; public asset CORS alone does not authorize API requests.

## JavaScript SDK

```html
<div id="companion"></div>
<script type="module">
  import { mount } from "https://mela.example/sdk/index.js";
  const companion = await mount({
    container: "#companion",
    api: "https://mela.example/api",
    videoUrl: "https://www.youtube.com/watch?v=9hE5-98ZeCg",
    lessonId: "va-future",
    language: "en",
    assistant: true,
  });
  // companion.setVideo("https://www.youtube.com/watch?v=another-id");
  // companion.destroy();
</script>
```

The IIFE alternative exposes the same `mount` and `register` methods on `window.MelaAI`. It registers both custom elements when loaded. ESM `register()` and `mount()` register them lazily in a browser, allowing SSR imports.

`mount()` returns `{ element, media, assistant, setVideo, destroy }`. The SDK appends its own section and leaves existing host children intact. `destroy()` removes only that instance and stops its playback/animation observers. Multiple instances may share an explicitly approved `contextRoot` without removing each other's context marker. Call `setVideo()` only with an approved public YouTube URL; it starts loading that new source.

`contextRoot` optionally accepts an element or selector for host-authored lesson content. Omit it to limit context to the SDK's own section. For generic paragraphs/headings, enable page context in the widget; host-authored `data-mela-section` content is extracted automatically. Scoping does not bypass the existing learner consent before page text goes to an external AI provider. The host can listen for `db-assistant:question`, `db-assistant:escalated`, `mela:video-state`, and `mela:transcript-ready` on the mounted element.

## React adapter

```tsx
import { MelaCompanion } from "@mela-ai/sdk/react";

export function Lesson() {
  return (
    <MelaCompanion
      api="https://mela.example/api"
      videoUrl="https://www.youtube.com/watch?v=9hE5-98ZeCg"
      onError={(error) => console.error(error.message)}
    />
  );
}
```

The adapter mounts after hydration, cleans up on unmount, and accepts the SDK options plus `className`, `style`, `onReady`, and `onError`. Importing/rendering it during SSR does not access `window` or `HTMLElement`.

## Iframe wrapper

```html
<iframe
  src="https://mela.example/embed?video=9hE5-98ZeCg"
  title="MELA learning companion"
  width="100%"
  height="900"
  allow="autoplay; fullscreen; microphone"
  allowfullscreen
  loading="lazy"
>
</iframe>
```

The wrapper uses the same React adapter and backend. Parent-page DOM is not available inside the iframe; use the component/SDK with an explicit `contextRoot` if host-page lesson context is needed.

## Captions and motion

The default course video is configured once in `data/lesson-media.json`. Prepare its public English caption cache using the optional step in the root README, or generate a new transcript with learner consent through Gemini. Cached public captions are fetched from the backend origin, including on foreign sites, and checked against the exact video ID.

The default visual teacher uses a procedural 3D human with coordinated arms, articulated fingers, cue-timed poses and caption-backed diagrams for the selected video. **Explain this moment** pauses the source and enlarges the concept. Demonstration replay has an independent 0.5×/0.75×/1× clock; only **Resume lesson** resumes the source. Seeking or switching video invalidates a captured explanation. Transcript keywords select the gesture; caption boundaries control its timing, long cues repeat a short cycle, and silence rests both hands. Seeking reconstructs the same pose. These are visual teaching gestures, not sign-language translation. Optional English fingerspelling remains experimental; a reviewed interpreter recording takes priority.

Set `renderer: "auto" | "2d" | "3d"` in `mount()` or the React props, `renderer="2d"` on `<mela-course-media>`, or `?renderer=2d` on `/embed`. The default `auto` respects data saving. `3d` explicitly tries WebGL; failures retain the 2D illustration and captions. Front, Hands focus and Reset view are available once 3D loads. System reduced motion requires an explicit Enable animation action.

The SDK does not bundle Three.js. Opening a visible panel requests `/avatar/teacher-3d.js` and `/avatar/storyboard.json` from the configured backend origin. Deploy both generated files, allow that script origin in the host CSP, and keep the backend's asset CORS headers. No model or texture downloads are needed. Closed, offscreen and hidden-tab previews stop updates; `destroy()` releases observers and GPU resources. After a first online load, the MELA service worker can cache these optional assets for its own origin; foreign hosts need their own offline caching policy. `mela:renderer-state` reports `{ renderer, status }` as a composed bubbling event.

Demo: `/demo/sdk.html`. Wrapper: `/embed`.

Host Content Security Policy must allow the selected SDK scripts, API connections, YouTube frames and component styles. Use the iframe wrapper when direct component styling conflicts with host policy; the host must allow the wrapper frame origin.

## Accessible chat preferences

Reading mode is available in the chat toolbar. It remembers a local browser preference, enlarges answer text and opens diagram text equivalents; no disability or TalkBack detection is attempted. New messages use a polite, additions-only chat log and an explicit busy state. Speech starts only through Listen. Advanced context/format/saved-answer controls are in Learning options; cloud sharing remains visible by the composer. These behaviors are shared by the Web Component, SDK and iframe. Real-device TalkBack/NVDA validation remains pending.

## English/Amharic browser-first experience (0.3.0)

Set `language: "am"` at installation or call `instance.setLanguage("am")` / `instance.setLanguage("en")`. Web Components accept `lang="am"`; iframe installations accept `?lang=am`. The React adapter updates language without remounting the lesson video. Independent SDK roots keep their own companion state.

Ordinary lesson questions use local browser retrieval. Prepared lesson/caption translations are downloaded only when needed; unknown text requires explicit consent for the private Gemini relay. Existing messages and source captions remain canonical. The lesson reader offers the English original and preserves source links and code. Amharic packs are AI drafts awaiting fluent review; video audio is unchanged.

Serve optional `/locale.js`, `/voice.js`, `/spelling.js`, `/i18n/am.json` and `/fonts/` alongside the generated bundle. Allow the MELA origin in the host's script, connect and font CSP. Microphone access needs HTTPS and browser permission; iframe hosts must grant microphone permission. No API key belongs in SDK options or frontend code. See [browser-first deployment](../../docs/BROWSER_FIRST.md) for relay, caching and microphone behavior.

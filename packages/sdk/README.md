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
  allow="autoplay; fullscreen"
  allowfullscreen
  loading="lazy"
>
</iframe>
```

The wrapper uses the same React adapter and backend. Parent-page DOM is not available inside the iframe; use the component/SDK with an explicit `contextRoot` if host-page lesson context is needed.

## Captions and motion

The default course video is configured once in `data/lesson-media.json`. Prepare its public English caption cache using the optional step in the root README, or generate a new transcript with learner consent through Gemini. Cached public captions are fetched from the backend origin, including on foreign sites, and checked against the exact video ID.

English fingerspelling follows source caption intervals; word/letter timing inside a cue is estimated. The procedural handshapes are experimental and require fluent review. This is not full ASL/EthSL translation. The alternative illustrative gestures are separately labelled. Play/pause, seeking and speed come from the source player's clock. Reduced motion pauses animation by default and offers an explicit Enable animation action. A reviewed interpreter recording takes priority when available.

Demo: `/demo/sdk.html`. Wrapper: `/embed`.

Host Content Security Policy must allow the selected SDK scripts, API connections,
YouTube frames and component styles. Use the iframe wrapper when direct component
styling conflicts with host policy; the host must allow the wrapper frame origin.

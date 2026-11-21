---
name: mela-integrate
description: Add MELA, the talking accessibility assistant for blind, Deaf and Ethiopian-language users (English, Amharic, Afaan Oromoo, Tigrinya), to a website or app. Use when the user asks to "add MELA", "integrate MELA", make a site talk / read answers aloud, add Amharic or Afaan Oromo voice, add captions or a sign-language visual aid, or call the MELA API (ask, tts, speech).
---

# Integrate MELA

MELA turns a website into a conversation: users ask by voice or text, MELA answers
out loud in their language, and shows captions plus a sign-language visual aid.

- Hosted MELA: `https://mela-ai-wheat.vercel.app` (call it `MELA` below)
- API base: `MELA/api/v1`
- Languages: `en`, `am` (Amharic), `om` (Afaan Oromoo), `ti` (Tigrinya)
- Docs page: `MELA/docs/integrate`

## Step 1 — pick the integration that fits

| The user wants…                                   | Use                                   |
| ------------------------------------------------- | ------------------------------------- |
| MELA on every website for themselves (no code)    | The browser extension (Option A)      |
| A help/chat assistant on their own site           | `<db-assistant>` web component (B)    |
| The voice "Talk to this website" panel            | `MelaActions.mountActions` (C)        |
| React / Next.js                                   | `@mela-ai/sdk/react` adapter (D)      |
| Their own UI, MELA as a backend                   | REST API (E)                          |

Ask only if it is genuinely unclear; otherwise choose B for a plain website and D for React.

## Option A — browser extension (end users)

1. Download `MELA/downloads/mela-extension.zip`, extract it to a new folder.
2. Chrome / Brave: `chrome://extensions` → Developer mode → **Load unpacked** → pick the folder.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
3. Click the MELA icon → **🔑 API keys** → paste an Addis AI key (Ethiopian languages) and/or a
   Groq or Gemini key (English) → **Save keys**.
4. On any page: **Ctrl+Shift+M** and talk. Say "speak Oromo" to switch language.
   After the first open, MELA opens and greets the user on every site.

## Option B — one script tag (any stack: HTML, PHP, WordPress, Django…)

```html
<script src="https://mela-ai-wheat.vercel.app/mela-sdk.js" defer></script>
<main data-mela-context>
  <!-- your page content; give key sections data-mela-section for better answers -->
  <db-assistant
    api="https://mela-ai-wheat.vercel.app/api"
    content="https://mela-ai-wheat.vercel.app/content.json"
    lang="en"
  ></db-assistant>
</main>
```

`lang` accepts `en | am | om | ti`. Styles are isolated in Shadow DOM.

## Option C — voice "Talk to this website" panel

```html
<script src="https://mela-ai-wheat.vercel.app/actions.js"></script>
<script>
  const MELA = "https://mela-ai-wheat.vercel.app/api/v1";
  const panel = MelaActions.mountActions({
    api: MELA,
    assistant: true,          // chat layout, big Talk button, hands-free mode
    speakAnswers: true,       // read every answer aloud
    language: "om",           // en | am | om | ti
    question: async (question, language) => {
      const r = await fetch(MELA + "/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, language, cloudConsent: true }),
      });
      const data = await r.json();
      return { status: "done", message: data.answer, sources: data.sources };
    },
    tts: async (text, language) => {   // natural Ethiopian voices; returns base64 WAV
      const r = await fetch(MELA + "/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      const bytes = new Uint8Array(await r.arrayBuffer());
      let s = ""; for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    },
  });
  // panel.open(); panel.talk(); panel.setLanguage("am"); panel.destroy();
</script>
```

Only send `cloudConsent: true` if the site has told users their question goes to an AI provider.

## Option D — React / Next.js

```tsx
import { MelaCompanion } from "@mela-ai/sdk/react";

export function Lesson() {
  return <MelaCompanion api="https://mela-ai-wheat.vercel.app/api" language="om" assistant />;
}
```

The adapter mounts after hydration and is SSR-safe. Build the package from the MELA repo
(`npm run widget:build && npm pack ./packages/sdk`) if it is not on the user's registry.

## Option E — REST API

All endpoints are `POST`, JSON in. Full spec: `MELA/openapi.yaml`.

| Endpoint                | Body                                                                 | Returns                     |
| ----------------------- | -------------------------------------------------------------------- | --------------------------- |
| `/api/v1/ask`           | `{ question, language, cloudConsent, context? }`                     | `{ answer, sources, … }`    |
| `/api/v1/tts`           | `{ text (≤1000 chars), language }`                                   | `audio/wav` bytes           |
| `/api/v1/speech`        | `{ audio (base64, ≤2 MB), mimeType, language, consent: true }`       | `{ text, language }`        |
| `/api/v1/translations`  | English → Amharic lesson text, batch format in `openapi.yaml`        | translated items            |

`context.sections` (≤30) lets MELA answer from the host page:
`{ id, title, content (≤6000 chars), url }`.

## Required server setup (self-hosting MELA)

Set these on the MELA server (e.g. Vercel env vars), never in browser code:

- `ADDIS_API_KEY` — Amharic / Afaan Oromoo / Tigrinya chat, voice and speech-to-text
- `GROQ_API_KEY` — fast English speech-to-text and answers (optional)
- `GEMINI_API_KEY` — backup for everything (optional)
- `ALLOWED_ORIGINS` — comma-separated exact origins of every site embedding MELA

If calls fail with CORS or 403, the host origin is missing from `ALLOWED_ORIGINS`.

## Accessibility rules — do not break these

- Keep the keyboard shortcut (**Ctrl/⌘+Shift+M** to talk) and never trap focus.
- Do not hide MELA's live region; screen readers rely on it.
- Browsers block audio until the first key press or click: announce text first, speak after.
- Describe the signing avatar as a **sign-language visual aid**, not Ethiopian Sign Language
  translation. Real EthSL must be built and validated with Deaf signers.
- Never put API keys in client code or commit them.

## Verify

1. Load the page, press Ctrl+Shift+M, ask "What is this page about?" — an answer appears and is spoken.
2. Switch to Afaan Oromoo (`lang="om"` / say "speak Oromo") — the reply and voice are in Oromo.
3. Tab through the page with a screen reader — MELA's messages are announced.

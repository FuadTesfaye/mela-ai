# Browser-first English and Amharic MVP

The learner experience runs inside the standalone Web Component. Ordinary questions search the current page and public course material locally, even when the site is online. The optional cloud checkbox enables a grounded server request; it is off by default. This is local retrieval, not a bundled generative model.

## Language and courses

Choose English or አማርኛ from Learning options. One setting controls new chat answers, the lesson reader and captions. Existing messages, draft questions and the video position are preserved. `Read lesson in Amharic` opens an accessible reader without replacing the host site's content. Original English is available alongside its source links; code blocks are preserved.

The Offline-First & Localized AI training lesson has a prepared Amharic reader. The selected demo video `9hE5-98ZeCg` ships with prepared English/Amharic captions. All Amharic translations are labelled AI drafts awaiting fluent review. Captions preserve the original cue timestamps; the original English transcript still drives illustrative gesture timing. Video audio is unchanged. The avatar is not validated sign-language interpretation.

New lesson text requires explicit consent before translation through Gemini. Successful results are cached locally in IndexedDB, with source revisions to prevent stale translations. Use the reader's cache removal control to clear saved translations. Prepared language assets and visited public material can be used offline after loading online. External YouTube playback, new translations, tutor replies and cloud requests need connectivity.

## Microphone

Select the microphone on HTTPS or localhost, accept the sharing explanation and grant browser permission. Supported browsers use SpeechRecognition in English or Amharic. Interim text stays editable and the question is never sent automatically. The browser's recognition service may require internet access.

Where browser recognition is unavailable, a separate consent prompt offers a short MediaRecorder recording sent to the private Gemini relay. Select Stop microphone to finish. Recordings are limited to 45 seconds and 2 MB. The relay does not persist audio. Close the chat or change language to cancel and stop microphone tracks. Permission denial, missing devices and unavailable providers show actionable status messages.

The automated browser checks exercise actual MediaRecorder capture with a synthetic microphone and mocked Gemini responses. Human speech quality, Amharic voice availability and physical-device TalkBack/NVDA still need real-device review. Live provider requests timed out in the development environment; prepared demo content does not need a new provider request.

## Vercel deployment

Deploy the Next.js repository normally; `npm run build` compiles the independent widget and optional language, voice and avatar assets. Set `GEMINI_API_KEY` privately in Vercel for new AI explanations, translations and audio transcription. Never put it in a `NEXT_PUBLIC_` variable or a script tag. `AI_PROVIDER=gemini` enables Gemini explanations when the learner explicitly opts in. Same-origin requests use the deployed request origin for CORS and source links, so the browser demo does not need localhost URLs configured.

`ALLOWED_ORIGINS` is required for additional external embedding origins. Configure those hosts' CSP for the MELA script/API/font origin and YouTube when using course playback. `DATABASE_URL`, tutor authentication and other service credentials are needed for persisted human help and external channels; ordinary browser retrieval and prepared readers/captions do not require PostgreSQL.

Live demo: https://mela-ai-wheat.vercel.app/savanna/pages/homepage-v1-self-paced.html

Optional browser assets: `/locale.js`, `/voice.js`, `/spelling.js`, `/i18n/am.json`, and `/fonts/noto-sans-ethiopic.woff2`. Language, microphone and avatar code load when needed. The Ethiopic font is a regular-weight subset of Google Fonts Noto Sans Ethiopic; its OFL licence ships under `public/fonts/`.

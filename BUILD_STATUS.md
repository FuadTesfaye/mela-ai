# Build and verification status

Recorded 16 November 2026. These checks describe local implementation evidence; physical assistive-technology and fluent language review remain pending.

## Current result

- Browser-first retrieval answers ordinary questions without calling the API. English/Amharic controls share language across the reader, captions and new answers while preserving drafts and video position. Prepared translation packs, the Ethiopic font and optional voice code load on demand. New Gemini translations and fallback audio transcription require explicit consent; the key stays server-side.
- Microphone checks cover native dictation events, permission denial, real browser MediaRecorder capture with synthetic audio, cancellation and editable transcripts. Live Gemini requests timed out locally; speech quality on learner devices remains unverified.
- The PowerPoint and PDF now describe the learner experience without test totals. See `docs/BROWSER_FIRST.md` for deployment details and provider limits.

- All demo course players default to `https://www.youtube.com/watch?v=9hE5-98ZeCg`, configured once in `data/lesson-media.json`.
- The selected Google for Developers video is 149 seconds long. Its existing English caption track was retrieved: 53 cues, with four overlapping boundaries normalized. Prepared English and AI-draft Amharic caption packs for this selected public demo now ship in Git. Other user-video caches remain ignored. `scripts/prepare-video.py` and `npm run prepare:translations` can refresh the demo assets.
- The default visual teacher is a procedural 3D person with two articulated hands, seven gesture poses, two camera views and eight source-backed teaching segments with readable diagrams. Illustrations explain concepts; they are not sign-language translation. Experimental fingerspelling and reviewed interpreter playback remain separate options.
- Transcript keywords now select the current illustrative gesture; each cue supplies its own timing and speech gaps rest both hands. Larger bilateral wrist motion and articulated fingers remain deterministic when seeking. Captions and teacher poses follow play/pause, source seeking and speed. Explain pauses and enlarges the current concept; local slow demonstration replay leaves the video paused until Resume. Reduced motion, hidden/offscreen updates, data saving, late downloads and WebGL failures have explicit behavior and fallback.
- An actual Chromium session loaded the real YouTube source, observed a playing clock and 149.221-second duration, and confirmed moving 3D hands with no page errors. A separate screenshot inspection checked the enlarged teacher/diagram/explanation layout. Controlled browser fixtures separately exercise synchronization and failure cases.
- The chat now keeps core actions visible and moves extra controls into Learning options. Reading mode persists locally, expands diagram text and supports larger answers. Labelled polite log announcements, pending-answer busy states, keyboard focus and forced colors are covered by native browser tests. No automatic speech or disability/TalkBack detection is used.
- Direct custom elements, a JavaScript SDK, an SSR-safe React adapter, a local npm tarball and an iframe wrapper are implemented. Cross-site API/media URLs resolve against the configured MELA backend. Multiple SDK instances preserve host content, share context ownership safely and isolate each other's video events.
- The original Savanna UI remains imported from `AaUel-Knight27/Savanna-static-pages` at `7e54f6d0fc3728568054fdb58b2d48523bc778ae`; provenance is in `public/savanna/UPSTREAM.json`. Earlier non-page asset hash checks matched upstream. The supplied 18-slide Offline-First & Localized AI training remains separate authored material.
- Reviewed EthSL recording/upload/review and synchronized interpreter playback remain available. A reviewed track takes priority over the experimental avatar for its exact lesson/video. No real signer recording has been supplied or linguistically validated.

## Verification

| Check                                                                                   | Observed result                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| TypeScript route generation/type checking                                               | Passed                                                                |
| Retrieval, security, Gemini, media, timing, handshape and SDK SSR unit tests            | Passed                                                                |
| Bundled widget/DOM tests, including source changes and first-caption context selection  | Passed                                                                |
| API Route Handler integration tests                                                     | Passed                                                                |
| Real PostgreSQL integration tests                                                       | Passed                                                                |
| Production Chromium browser tests                                                       | Passed; none skipped                                                  |
| Total automated tests                                                                   | Passed                                                                |
| Production build                                                                        | Passed with webpack and compiler-API type checking                    |
| Plain HTML SDK on a separate origin                                                     | Passed with real backend requests and controlled source-clock fixture |
| React/iframe wrapper                                                                    | Passed, including hydration and playback controls                     |
| Scoped axe scans, keyboard dialog close/focus, reduced-motion override and 320px layout | Passed within the browser suite                                       |
| Source-caption preparation                                                              | 53 real English cues fetched and served locally                       |
| Real YouTube player smoke check                                                         | Clock advanced; hands visibly moved; no page errors                   |
| SDK package                                                                             | Tarball created with ESM core, React adapter, types and README        |
| OpenAPI                                                                                 | YAML parsed; all local references resolved                            |
| Supplied-key exposure scan                                                              | No matches in tracked or public files                                 |

CI runs fixture-based unit/widget/API checks without a database URL, then migrates its integration database before PostgreSQL and browser checks. This prevents fixture tests from querying unmigrated signing tables.

The PostgreSQL checks used an isolated temporary PostgreSQL 17 container. All migrations applied and demo data seeded. Database tests cover ticket authorization/replies/screen signaling and signing publication/replacement/unpublishing. The production browser run also exercised an actual tutor reply through that database.

Gemini unit tests mock provider responses. The live Gemini model metadata endpoint was reachable, but video-transcription requests timed out. The selected demo works from its existing source captions; no transcript is invented when a provider fails.

## Bundle sizes

| Asset                             |  Uncompressed |          Gzip |
| --------------------------------- | ------------: | ------------: |
| Chat widget                       |  44,358 bytes |  15,444 bytes |
| Course-media component            |  52,323 bytes |  17,432 bytes |
| Combined browser SDK              |  98,630 bytes |  32,255 bytes |
| ESM core SDK                      |  98,211 bytes |  32,094 bytes |
| React adapter (React is external) |     878 bytes |     475 bytes |
| Optional 3D runtime               | 569,205 bytes | 145,025 bytes |

The chat widget remains below its enforced 500,000-byte ceiling. Builds also enforce a 100,000-byte initial SDK and 250,000 gzip-byte optional 3D runtime. Optional language, font, voice and fingerspelling assets stay outside the initial SDK. The 3D runtime is requested on demand and contains Three.js; it is not part of that initial SDK. The core SDK does not require React or Tailwind on the host website.

The current procedural renderer reports 16,384 triangles, seven shared geometries and 16 draw calls (previously 111) in a single front-view frame. Browser tests check all seven poses in both camera views with both hands in frame, and three repeated mount/dispose cycles leave zero allocated geometries and no canvas. Frame targets are capped at 60 fps desktop/30 fps mobile, with limited pixel ratio and adaptive resolution; these are not real-device performance guarantees. Geometry is project-owned and Three.js is MIT licensed.

The development command now uses webpack, matching the production build. A Turbopack development reload loop prevented the React iframe from mounting; the webpack server passed all 15 SDK/signing/teacher browser checks, and the production server passed the complete 34-case suite.

## Remaining validation

- Fluent signer/co-designer review of the manual-alphabet prototype and any real EthSL recording; no linguistic conformance is claimed.
- Real-device NVDA/TalkBack, real microphone/speech-engine behavior and full imported-host accessibility audit. Scoped browser axe checks are not certification.
- Live Gemini video generation quality/quota/latency and other service credentials, Telegram/SMS/TURN delivery and production HTTPS operations.
- The organiser's required licence and official Savanna account integration remain separate release inputs.

Development demo: `/savanna/pages/programming-for-beginners.html`. Standalone SDK demo: `/demo/sdk.html`. Wrapper: `/embed`. The backend development server was verified at `http://localhost:3000`; isolated production/database test services are cleaned up after validation.

## GitHub checkpoints

Remote: `git@github.com:FuadTesfaye/mela-ai.git`. The current three-commit batch covers GPU instancing for the articulated teacher, a simpler chat with private Reading mode, then accessibility/performance verification and documentation. Push without force; repository history is the source of truth for published commits.

The latest real YouTube smoke check sought into the source screen-sharing exchange, displayed its matching English caption, selected the pointing gesture, and observed both 3D hands changing during playback with zero page errors. Desktop and 320px enlarged-panel screenshots were manually inspected. One parallel screenshot capture initially collided with the suite's trace files; the production suite was rerun on its own. Existing service checks and source-caption preparation observations above remain separately identified.

The renderer optimization follows the official Three.js instancing documentation and manual. The measured reduction is 95 draw calls, about 86% less GPU submission work; frame-rate targets are still caps, not real-device guarantees. A fresh live YouTube session again showed advancing source time, both moving hands, a matching English caption and no page errors. The 320px Reading mode screenshot was inspected; the complete 34-case production suite passed with the isolated database, alongside 49 unit, 28 widget, 10 API and two PostgreSQL tests. Earlier development checks included a slow /learn response; the production suite passed that route. Guidance sources and Android/TalkBack device-check steps are in README and CONFORMANCE. Actual TalkBack/NVDA testing remains pending.

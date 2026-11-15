# Build and verification status

Recorded 15 November 2026. These are observed local checks, not a production deployment or accessibility certification.

## Current result

- All demo course players default to `https://www.youtube.com/watch?v=9hE5-98ZeCg`, configured once in `data/lesson-media.json`.
- The selected Google for Developers video is 149 seconds long. Its existing English caption track was retrieved: 53 cues, with four overlapping boundaries normalized. The local JSON cache is excluded from Git; `scripts/prepare-video.py` and its pinned optional dependency reproduce it on a deployment.
- The default visual teacher is a procedural 3D person with two articulated hands, seven gesture poses, two camera views and eight source-backed teaching segments with readable diagrams. Illustrations explain concepts; they are not sign-language translation. Experimental fingerspelling and reviewed interpreter playback remain separate options.
- Captions and teacher poses follow play/pause, source seeking and speed. Explain pauses and enlarges the current concept; local slow demonstration replay leaves the video paused until Resume. Reduced motion, hidden/offscreen updates, data saving, late downloads and WebGL failures have explicit behavior and fallback.
- An actual Chromium session loaded the real YouTube source, observed a playing clock and 149.221-second duration, and confirmed moving 3D hands with no page errors. A separate screenshot inspection checked the enlarged teacher/diagram/explanation layout. Controlled browser fixtures separately exercise synchronization and failure cases.
- Direct custom elements, a JavaScript SDK, an SSR-safe React adapter, a local npm tarball and an iframe wrapper are implemented. Cross-site API/media URLs resolve against the configured MELA backend. Multiple SDK instances preserve host content, share context ownership safely and isolate each other's video events.
- The original Savanna UI remains imported from `AaUel-Knight27/Savanna-static-pages` at `7e54f6d0fc3728568054fdb58b2d48523bc778ae`; provenance is in `public/savanna/UPSTREAM.json`. Earlier non-page asset hash checks matched upstream. The supplied 18-slide Offline-First & Localized AI training remains separate authored material.
- Reviewed EthSL recording/upload/review and synchronized interpreter playback remain available. A reviewed track takes priority over the experimental avatar for its exact lesson/video. No real signer recording has been supplied or linguistically validated.

## Verification

| Check                                                                                   | Observed result                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| TypeScript route generation/type checking                                               | Passed                                                                |
| Retrieval, security, Gemini, media, timing, handshape and SDK SSR unit tests            | 47 passed                                                             |
| Bundled widget/DOM tests, including source changes and first-caption context selection  | 28 passed                                                             |
| API Route Handler integration tests                                                     | 10 passed                                                             |
| Real PostgreSQL integration tests                                                       | 2 passed                                                              |
| Production Chromium browser tests                                                       | 31 passed; none skipped                                               |
| Total automated tests                                                                   | 118 passed                                                            |
| Production build                                                                        | Passed with webpack and compiler-API type checking                    |
| Plain HTML SDK on a separate origin                                                     | Passed with real backend requests and controlled source-clock fixture |
| React/iframe wrapper                                                                    | Passed, including hydration and playback controls                     |
| Scoped axe scans, keyboard dialog close/focus, reduced-motion override and 320px layout | Passed within the browser suite                                       |
| Source-caption preparation                                                              | 53 real English cues fetched and served locally                       |
| Real YouTube player smoke check                                                         | Clock advanced; hands visibly moved; no page errors                   |
| SDK package                                                                             | Tarball created with ESM core, React adapter, types and README        |
| OpenAPI                                                                                 | YAML parsed; 157 local references resolved across 21 paths            |
| Supplied-key exposure scan                                                              | No matches in tracked or public files                                 |

CI runs fixture-based unit/widget/API checks without a database URL, then migrates its integration database before PostgreSQL and browser checks. This prevents fixture tests from querying unmigrated signing tables.

The PostgreSQL checks used an isolated temporary PostgreSQL 17 container. All migrations applied and demo data seeded. Database tests cover ticket authorization/replies/screen signaling and signing publication/replacement/unpublishing. The production browser run also exercised an actual tutor reply through that database.

Gemini unit tests mock provider responses. The live Gemini model metadata endpoint was reachable, but video-transcription requests timed out. The selected demo works from its existing source captions; no transcript is invented when a provider fails.

## Bundle sizes

| Asset                             |  Uncompressed |          Gzip |
| --------------------------------- | ------------: | ------------: |
| Chat widget                       |  45,081 bytes |  15,170 bytes |
| Course-media component            |  51,633 bytes |  17,218 bytes |
| Combined browser SDK              |  99,581 bytes |  32,149 bytes |
| ESM core SDK                      |  99,162 bytes |  31,968 bytes |
| React adapter (React is external) |     738 bytes |     419 bytes |
| Optional 3D runtime               | 565,186 bytes | 143,923 bytes |

The chat widget remains below its enforced 500,000-byte ceiling. Builds also enforce a 100,000-byte initial SDK and 250,000 gzip-byte optional 3D runtime. The initial SDK has only 419 bytes of remaining budget. The 3D runtime is requested on demand and contains Three.js; it is not part of that initial SDK. The core SDK does not require React or Tailwind on the host website.

The current procedural renderer reports 16,384 triangles, seven shared geometries and 111 draw calls in a single front-view frame. Browser tests check all seven poses in both camera views with both hands in frame, and three repeated mount/dispose cycles leave zero allocated geometries and no canvas. Frame targets are capped at 60 fps desktop/30 fps mobile, with limited pixel ratio and adaptive resolution; these are not real-device performance guarantees. Geometry is project-owned and Three.js is MIT licensed.

The development command now uses webpack, matching the production build. A Turbopack development reload loop prevented the React iframe from mounting; the webpack server passed all 15 SDK/signing/teacher browser checks, and the production server passed the complete 31-case suite.

## Remaining validation

- Fluent signer/co-designer review of the manual-alphabet prototype and any real EthSL recording; no linguistic conformance is claimed.
- Real-device NVDA/TalkBack, real microphone/speech-engine behavior and full imported-host accessibility audit. Scoped browser axe checks are not certification.
- Live Gemini video generation quality/quota/latency and other service credentials, Telegram/SMS/TURN delivery and production HTTPS operations.
- The organiser's required licence and official Savanna account integration remain separate release inputs.

Development demo: `/savanna/pages/programming-for-beginners.html`. Standalone SDK demo: `/demo/sdk.html`. Wrapper: `/embed`. The backend development server was verified at `http://localhost:3000`; isolated production/database test services are cleaned up after validation.

## GitHub checkpoints

Remote: `git@github.com:FuadTesfaye/mela-ai.git`. The current three-commit batch covers the procedural rig, synchronized visual teaching/SDK integration, then browser tests and documentation. Push without force; repository history is the source of truth for published commits.

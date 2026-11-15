# Build and verification status

Recorded 15 November 2026. This describes the local implementation and observed checks, not a production deployment or accessibility certification.

## Current learner experience

- `/` opens the imported original Savanna self-paced UI; `/learn` opens the original concept UI. The paced capture, original styles/fonts/images, sidebar and module/week scripts are retained.
- The pinned source is `AaUel-Knight27/Savanna-static-pages` at `7e54f6d0fc3728568054fdb58b2d48523bc778ae`. Git clone was blocked by DNS; the connected GitHub source export imported 165 files. All non-page upstream asset Git hashes were verified. Page edits add MELA integration tags; provenance is in `public/savanna/UPSTREAM.json`.
- MELA is docked and open on desktop, with a prominent support strip. Course support defaults to English. Current authored lesson text, selected modules/weeks, and approved transcript context are extracted; unrelated browser tabs and private forms are excluded.
- The user-supplied **Offline-First & Localized AI** session by **Kidus Yohannes · Senior ML Engineer** is rendered as 18 English slides with quiz/answers, homepage/sidebar links, slide-level citations and saved offline source search.
- A native Gemini adapter and public-YouTube transcription API are implemented. The supplied key is stored only in the ignored local configuration file; tracked and public files were checked for matches and none were found. Gemini requires the learner’s sharing choice and degrades explicitly to source text on failure.
- The course video box supports English timestamped transcripts, text download, browser-local saved transcript restoration, and transcript-to-chat context. The small EthSL panel can synchronize a reviewed media clip with an exact YouTube video binding. No validated clip was supplied, so signing remains visibly unavailable.
- PostgreSQL tickets, tutor replies, screenshot review, screen-sharing code, Telegram/text gateways, job alerts, accommodation requests, optional avatar, Compose, CI, OpenAPI and documentation remain included.

## Checks completed

| Check                                                                                               | Result                                                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| TypeScript route generation/type checking                                                           | Passed                                                                       |
| Retrieval/security/Gemini/media unit tests                                                          | 27 passed                                                                    |
| Bundled widget, original Savanna DOM, module/week context, transcript UI and offline training tests | 13 passed                                                                    |
| HTTP Route Handler integration tests                                                                | 9 passed                                                                     |
| Production build                                                                                    | Passed with webpack and compiler-API type checking                           |
| Chat widget size                                                                                    | 33,481 bytes uncompressed; 11,488 gzip bytes; enforced ceiling 500,000 bytes |
| Separate course-media module                                                                        | 13,194 bytes uncompressed; 5,114 gzip bytes                                  |
| Separate Savanna integration module                                                                 | 4,548 bytes uncompressed; 1,990 gzip bytes                                   |
| Original non-page capture assets                                                                    | All checked Git blob hashes match upstream                                   |
| Docker Compose configuration                                                                        | Passed `docker compose config --quiet` with temporary validation values      |
| OpenAPI                                                                                             | YAML parsed; all 153 local references resolved across 18 paths               |
| Credential exposure check                                                                           | No supplied-key matches in tracked or public files                           |

Gemini tests use mocked provider responses to exercise the actual request body, private header authentication, consent gate, citation validation, transcript validation and cache. Widget DOM tests run the actual bundled component with the real answer handler; they are not a visual browser test.

## Blocked or pending verification

- Local HTTP binding is blocked (`listen EPERM`); no running preview URL is claimed.
- Chromium is blocked by sandbox socket restrictions. Visual layout, browser axe, keyboard/screen-reader behavior, real offline reload, YouTube playback/WebGL and signing synchronization require browser testing elsewhere. Browser axe tests target the added assistant; the imported host needs its own full accessibility audit.
- Docker daemon access is denied. Compose syntax was validated, but containers and real PostgreSQL ticket/reply/media flows were not run. The PostgreSQL integration test is available and skipped without TEST_DATABASE_URL.
- A live request using the locally configured Gemini key was attempted and failed at network fetch. Key validity, model availability, provider quota and real transcription quality have **not** been verified. No transcript is fabricated when the service is unavailable.
- No real session recording or validated EthSL clip was provided for the supplied training. The YouTube player is clearly labelled as an optional example, not that recording. Other service credentials and live channel/TURN validation remain necessary.
- Official Savanna account integration, fluent Amharic review and co-designer testing remain release gates. No local generative model weights are bundled; offline operation uses source retrieval and saved text.

## GitHub checkpoints

The intended remote is the private `FuadTesfaye/mela-ai` repository. Local commits preserve each logical change, with push attempts at three-commit checkpoints. Repository creation and previous pushes failed because GitHub DNS/network access was unavailable; the local CLI also reported invalid credentials.

No successful GitHub write has been verified. Source and history remain local. Restore network/authentication, create the private repository if needed, and push main without force.

Follow CONFORMANCE.md before claiming production readiness or accessibility conformance. The organiser’s required licence still needs to be supplied.

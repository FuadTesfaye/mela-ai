# Build and verification status

Recorded 15 November 2026. This describes the local implementation and observed checks, not a production deployment or accessibility certification.

## Current learner experience

- `/` opens the imported original Savanna self-paced UI; `/learn` opens the original concept UI. The paced capture, original styles/fonts/images, sidebar and module/week scripts are retained.
- The pinned source is `AaUel-Knight27/Savanna-static-pages` at `7e54f6d0fc3728568054fdb58b2d48523bc778ae`. Git clone was blocked by DNS; the connected GitHub source export imported 165 files. All non-page upstream asset Git hashes were verified. Page edits add MELA integration tags; provenance is in `public/savanna/UPSTREAM.json`.
- MELA is docked and open on desktop, with a prominent support strip. Course support defaults to English. Current authored lesson text, selected modules/weeks, and approved transcript context are extracted; unrelated browser tabs and private forms are excluded.
- The user-supplied **Offline-First & Localized AI** session by **Kidus Yohannes · Senior ML Engineer** is rendered as 18 English slides with quiz/answers, homepage/sidebar links, slide-level citations and saved offline source search.
- A native Gemini adapter and public-YouTube transcription API are implemented. The supplied key is stored only in the ignored local configuration file; tracked and public files were checked for matches and none were found. Gemini requires the learner’s sharing choice and degrades explicitly to source text on failure.
- The course video box supports English timestamped transcripts, text download, browser-local saved transcript restoration, and transcript-to-chat context. The small EthSL panel can synchronize a reviewed media clip with an exact YouTube video binding. Without a reviewed clip, the learning panel now provides synchronized AI captions and an explicitly experimental animated gesture preview.
- PostgreSQL tickets, tutor replies, screenshot review, screen-sharing code, Telegram/text gateways, job alerts, accommodation requests, optional avatar, Compose, CI, OpenAPI and documentation remain included.

- The dedicated Programming for Beginners page uses the selected `bJzb-RuUcMU` video, separate from the offline training. Timestamp-aware question snapshots, four explanation formats, safe local SVG diagrams with text alternatives, explicit saved explanations, and consented actual video-segment analysis are implemented.
- `/dashboard/signing` supports camera recording and private uploads, separate declared fluent review, approval/rejection/unpublishing, exact video binding, synchronized/enlarged signing playback, byte-range serving and persistent Docker media storage. No real signer recording or live camera session has been validated. Shared tutor authentication cannot independently verify signer/reviewer identities or fluency.

## Checks completed

| Check                                                                                               | Result                                                                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| TypeScript route generation/type checking                                                           | Passed                                                                       |
| Retrieval/security/Gemini/media unit tests                                                          | 37 passed                                                                    |
| Bundled widget, original Savanna DOM, module/week context, transcript UI and offline training tests | 27 passed                                                                    |
| HTTP Route Handler integration tests                                                                | 10 passed                                                                    |
| Production build                                                                                    | Passed with webpack and compiler-API type checking                           |
| Chat widget size                                                                                    | 44,828 bytes uncompressed; 15,090 gzip bytes; enforced ceiling 500,000 bytes |
| Separate course-media module                                                                        | 29,624 bytes uncompressed; 10,219 gzip bytes                                 |
| Separate Savanna integration module                                                                 | 4,788 bytes uncompressed; 2,047 gzip bytes                                   |
| Original non-page capture assets                                                                    | All checked Git blob hashes match upstream                                   |
| Docker Compose configuration                                                                        | Passed `docker compose config --quiet` with temporary validation values      |
| OpenAPI                                                                                             | YAML parsed; all 157 local references resolved across 21 paths               |
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

The remote is `git@github.com:FuadTesfaye/mela-ai.git`. Local commits preserve logical changes, with pushes at three-change checkpoints. The latest push of `be279ae` to `main` succeeded on 15 November 2026. Earlier DNS/authentication failures no longer describe the current Git push result. Repository visibility has not been independently verified in this session.

Follow CONFORMANCE.md before claiming production readiness or accessibility conformance. The organiser’s required licence still needs to be supplied.

## Latest validation limits

All 74 executable unit/DOM/API-handler cases pass (37 + 27 + 10). Two PostgreSQL integration cases are included but skipped without `TEST_DATABASE_URL`, including approval replacement and unpublishing. The production build passes. Starting the server remains blocked by the sandbox (`listen EPERM` on port 3000); live browser, camera, Gemini and full signer validation are pending.

## Signing panel follow-up

The interpreter starts hidden and is loaded explicitly through Show learning panel. Opening midway joins the source timestamp; pause, buffering, seek, replay, speed, hidden state and enlarged playback are covered by eight additional bundled DOM tests. Source changes clear the old media immediately and reject stale configuration responses. Playback errors and blocked autoplay have separate recovery controls. The panel sits beside the video on desktop and below it on small screens, with a reduced-motion-aware transition. Two new native browser cases were attempted but could not launch Chromium (`sandbox_host_linux.cc`, operation not permitted); their assertions have not run.

## MVP captions and animated person

The default panel now offers caption-only, avatar-only and combined views instead of a dead-end unavailable message. Captions follow the source timestamp; a procedural SVG person uses illustrative greeting, pointing, counting, comparison and connection movements selected from the current cue. Arm, hand and finger motion is synchronized to playback, with paused/hidden/disposed animation cancellation and reduced-motion poses. This is a visibly labelled gesture prototype, not EthSL translation. Approved interpreter media takes priority when present. The offline shell cache was versioned so clients can receive the new course module.

Two timeline/preset unit tests and four additional bundled DOM tests cover consent, generation, source switching, cue gaps, modes, approved-interpreter precedence, errors/retry, animation frames and cleanup. A fresh live transcription request for the supplied YouTube video was attempted with the locally configured key; it failed at network fetch, so key validity and real transcript quality remain unverified. Browser-native checks remain blocked by Chromium sandbox restrictions.

# MELA AI — accessibility conformance evidence

Target: WCAG 2.2 AA. **Status: not yet independently verified.** This is an implementation/evidence inventory, not a certification or a claim of complete conformance.

## Implemented support

| Area                  | Implementation                                                                                                | Verification status                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Keyboard and focus    | Native controls, visible outlines, skip link, Escape closes chat, focus returns to launcher; chat is nonmodal | DOM workflow tests pass; real keyboard/browser validation pending            |
| Screen-reader chat    | Named dialog, labelled input and controls, role=log with polite additions, separate status region             | Markup and DOM tests; NVDA/TalkBack pending                                  |
| Language and text     | English/Amharic labels and content, message dir=auto, Unicode retrieval                                       | Bilingual unit/API/DOM tests pass; fluent review and Arabic RTL test pending |
| Reflow and zoom       | Responsive workspace, mobile widget bounded by dynamic viewport, wrapping messages                            | Type/build checks pass; 320px and 200% manual checks pending                 |
| Contrast and motion   | Green/cream palette, visible focus, reduced-motion CSS and avatar support                                     | Browser axe/contrast audit pending                                           |
| Alternatives to audio | Full text and source links, sound-off operation by design                                                     | DOM answer tests pass; manual task pending                                   |
| Speech                | Capability detection, matching language voice, microphone confirmation, text fallback                         | Device and Amharic voice validation pending                                  |
| Human help            | Sharing preview, explicit consent, private tickets, optional screenshot and stoppable capture                 | Consent DOM tests pass; PostgreSQL/tutor/browser integration pending         |
| Offline               | Public knowledge cache and host-owned public-page worker                                                      | In-memory offline retrieval test passes; real offline reload pending         |
| Avatar and signing    | Optional WebGL speaking character; no fabricated signing                                                      | WebGL/browser preview pending; EthSL not enabled                             |

## Automated evidence in this workspace

- TypeScript and production build pass (final results recorded in BUILD_STATUS.md).
- Retrieval/security unit tests, API integration tests and widget DOM tests pass.
- Widget bundle has an enforced 500,000-byte uncompressed limit.
- PostgreSQL test is available but skipped without TEST_DATABASE_URL.
- Playwright/axe tests exist for the dashboard, lessons, jobs, support, blank HTML and three Savanna fixtures. They were not run successfully here: the environment blocks Chromium and local server sockets. Zero critical/serious axe violations is a release requirement, not an achieved claim.

## Required co-designer task

On the co-designer’s own device, without assistance:

1. Open the current lesson and the assistant using keyboard or assistive technology.
2. Select English or Amharic and ask a lesson question.
3. Read the relevant answer and follow its citation. Repeat with sound off.
4. Use Listen where supported and verify that unavailable voices are explained.
5. Request human help, review sharing choices, create a ticket, and read a tutor reply.
6. Start/stop screen capture where supported; otherwise share optional context or a screenshot.
7. Repeat at 200% zoom and 320px width; verify no essential action or content is lost.
8. Test NVDA and TalkBack, RTL text, reduced motion, slow 3G, and offline content after an online visit.
9. Explore a demo job and request an interview accommodation. Verify alert opt-in and unsubscribe with configured services.

Record device/browser versions, assistive technology, date, participant-approved feedback, failures and resolutions. Do not store diagnoses or unnecessary identifying information.

## Known limits

- The original public Savanna capture is now imported at a pinned revision, with DOM tests for authored lesson extraction and live module changes. It has not been verified by organisers or tested visually here. Upstream host accessibility defects are not certified as fixed.
- Amharic translations need fluent review; browser speech availability varies.
- Cloud citation checks cannot establish semantic accuracy of generated prose. Default extractive answers avoid unsupported generation.
- Tutor/alert/channel/relay services need live configuration and end-to-end validation. No always-online tutor promise is made.
- Sign-language translation, validated EthSL clips, tenant-aware LMS authorisation, and durable learner ticket recovery are not implemented.
- Real screenshot safety, production TURN credentials, distributed rate limits, retention operations and deployment security need hardening beyond this demo.

## Savanna/video/training update

The learner entry points use the imported Savanna capture. English training content, all 18 supplied slides, revealable quiz answers, prominent support entry points and slide-level citations are included. DOM tests cover offline training retrieval and live page/transcript context.

YouTube is loaded only on learner action. Gemini transcription requires separate consent and produces explicitly unreviewed English text; saved public transcripts can be restored locally. Live Gemini video generation still timed out during verification. Native YouTube playback was verified for the selected source, including an advancing player clock and visible hand motion. Reviewed EthSL playback still requires an approved clip bound to the exact lesson video. The learning panel now offers synchronized AI captions and an experimental procedural gesture preview when no clip is available. This preview is explicitly not EthSL translation.

Browser axe tests target the added assistant; a full audit of the imported host is still required.

### Video explanations and signing review

Structured explanations include source references and text equivalents for locally rendered diagrams. Video timestamps are captured at question time; ordinary playback ticks do not cancel responses. Cloud video/frame analysis requires explicit consent. Saved explanations are opt-in browser storage with a removal control; offline access does not include video playback or a local generative model.

EthSL recordings use a private upload and human review lifecycle, with approved-only learner playback and an enlargement control. Review declarations are not proof of linguistic validation. No fluent signer session, real recording, camera synchronization, cross-browser media playback, NVDA/TalkBack, or live Gemini video assessment has been completed in this environment. A fluent co-designer must review meaning, facial expression, signing space, coverage and timing before publication. Generic avatar motion is never presented as sign language.

The learning panel starts hidden, uses an explicit Show/Hide control with expanded state, and places the interpreter outside the YouTube control area. It waits for metadata before seeking, corrects drift above 0.5 seconds, prevents overlapping play requests, and preserves media when enlarged. Opening animation is disabled for reduced motion. Simulated media tests cover playback states and stale requests; native browser tests for 320px/desktop layout, keyboard focus and Escape now pass in this environment. The procedural avatar follows source time; linguistic quality still requires fluent-signer validation.

### Experimental MVP preview

Captions-only, avatar-only and combined modes are available. The preview's SVG person uses illustrative arm/hand/finger presets selected from transcript text; no linguistic coverage or sign-language accuracy is claimed. A visible label distinguishes this from reviewed EthSL recordings. Caption cues remain readable and source-timed, including gaps and seeking. Reduced-motion settings use static poses; hidden, paused and disposed previews stop their animation loop. Public source transcripts are saved on the device after successful consented generation. The latest live Gemini video transcription attempt timed out. Source English captions were obtained independently and actual browser playback was verified. Real-device screen-reader testing remains pending.

### Selected-video SDK verification

Every demo course defaults to the same configured video. A local source-caption preparation script retrieved 53 English cues and normalized four overlapping boundaries. Cue timing comes from the source; word and letter timing within a cue is estimated. The manual-alphabet handshape prototype is not validated ASL/EthSL translation. Reduced motion has a visible explanation and explicit Enable animation action.

Native Chromium checks pass for the SDK hosted on another origin, backend-relative caption URLs, play/pause/seek/speed synchronization, motion override, 320px overflow, a scoped serious/critical axe scan, keyboard dialog controls, React hydration through the iframe wrapper, and multiple-instance teardown preserving host content. React SSR imports/rendering are unit-tested without DOM globals. These checks do not certify language accuracy or whole-site accessibility.

The production browser suite now runs with an isolated migrated PostgreSQL database and passes all 22 cases, including the tutor-reply flow. The two direct PostgreSQL integration tests also pass. Multiple SDK assistants are scoped to their own mounted roots; prepared captions automatically select whole-video question context after the initial player-state event.

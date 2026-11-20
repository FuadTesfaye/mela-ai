# MELA AI

**Ask once. Keep learning.** An accessible English/Amharic learning companion for Digital Bridge Track 3, integrated into the original Savanna static UI.

Next.js powers the learner workspace, tutor portal, and APIs. An independent TypeScript Web Component provides chat on plain HTML or another LMS. PostgreSQL persists consented support requests and channel preferences. No AI key is needed for the default source-extraction mode.

Try the standalone SDK at `/demo/sdk.html`, the iframe wrapper at `/embed`, or read the [SDK integration guide](packages/sdk/README.md).

Project overview: [PowerPoint](docs/presentation/MELA-AI-Project-Overview.pptx) · [PDF](docs/presentation/MELA-AI-Project-Overview.pdf) · [presentation guide](docs/presentation/README.md).

## PWA, downloaded courses and web commands

- `/offline.html` (also `/downloads`) is the installable learning library. Download an approved course, then open it from saved storage. Packs include lesson text, a prepared Amharic resource where available, saved captions, a font and optional source-backed practice questions. Video streaming remains online-only.
- `/demo/actions.html` demonstrates the web voice assistant. Use **Learning options → Use web voice commands** in the chat to open the same action panel on a lesson.
- The action panel supports explicit commands such as `read page`, `scroll down`, `find Downloads`, `click Next`, `fill Practice name with Hana`, `pause video`, and `stop`. `explain page` and `explain selection` show labelled source text in this no-generation action engine. Course explanations remain available in the assistant.
- Microphone transcripts stay editable; **Run command** executes them. Every activation and field fill requires confirmation. Multiple matches become choices; changed or disconnected targets are rejected. Passwords, file uploads and payment/authentication fields are excluded. Cross-origin frames, browser-internal pages and closed shadow roots are not controlled.
- **Listen to result** uses an available device voice, reading the beginning of long results. Text always remains available. English and Amharic have supported command phrases; the language selector does not imply reliable speech support for every device/language.
- Build the Chromium extension with `npm run extension:build`. Load `extension/dist` as an unpacked extension from `chrome://extensions` or Edge's extension page. Click its toolbar action or use **Alt+Shift+M** on an HTTP(S) page. The packaged archive is `extension/mela-extension.zip`. It requests active-tab access after a learner gesture and bundles its own executable code. The extension is an MVP, not a store-published or universally compatible browser agent.

The PWA installs this MELA-hosted experience. It does not turn an arbitrary third-party website into an offline PWA. Embedded partners keep control of their own service worker and installation scope.

Downloads use IndexedDB and revision-specific caches. Course revisions include source sections, resource identities/hashes and practice content. Files are checked before publication to the saved library; interrupted downloads retain verified resources for retry and a previous complete revision remains available while its replacement downloads. The library reports missing resources after cache eviction. Browser storage is not a permanent backup.

English/Amharic materials retain canonical source citations. Amharic is explicitly an AI draft pending review. Afaan Oromo (`om`) and Tigrinya (`ti`) now have shared registry, validation and database support; their lesson translations are **not yet available**, so the interface explicitly shows original source text. No on-device generative model is bundled.

## Supabase deployment and migration safety

Keep the existing Next.js API and tutor authentication. Supabase supplies PostgreSQL and, when configured, private interpreter storage. No Supabase browser Data API access is required by this implementation.

Set these privately in the hosted app:

| Setting                                         | Purpose                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                  | Supabase shared transaction-pool endpoint, port 6543; copy its exact host/user from Connect         |
| `MIGRATION_DATABASE_URL`                        | Session-pool endpoint on port 5432, or a reachable direct endpoint; used only by deployment tooling |
| `DB_POOL_MAX`                                   | Default 1 on Supabase/serverless; raise only with measured demand                                   |
| `APP_URL`, `ALLOWED_ORIGINS`                    | Exact HTTPS deployment and authorised embedding origins                                             |
| `ADMIN_PASSWORD`, `SESSION_SECRET`              | Tutor password of at least 12 characters and random signing secret of at least 32 characters        |
| `DEFAULT_COURSE_ID`                             | `va-foundations` by default                                                                         |
| `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional consented model responses; verify model availability in the actual project                 |

Use the replacement database password in secret settings; do not commit it. URL-encode reserved characters when constructing a connection URL. Supabase connections require verified TLS. If your deployment requires a private CA, configure its trusted CA through the Node environment rather than disabling certificate verification. The existing `pg` queries do not use named prepared statements. Migration tooling rejects the transaction-pool endpoint because its session advisory lock requires a stable session.

Run `npm run widget:build`, `npm run db:migrate`, and `npm run db:seed` from a deployment environment with the appropriate secret settings. The numbered SQL migrations and `schema_migrations` remain authoritative. Migration 004 enables RLS and removes anonymous/authenticated Data API grants on the application's tables; the server's database role must remain authorised to use them. Migration 005 adds the durable Telegram inbox. Existing rows and the migration ledger are preserved.

Drizzle integration files are prepared in `drizzle/schema.mjs`, `drizzle.config.mjs` and `lib/database/orm.mjs`, using the existing `pg` pool. **The npm registry was unreachable during this implementation, so Drizzle dependencies were not installed and this optional adapter is not active.** The application continues using its tested `pg` adapter. In a network-enabled environment, install `drizzle-orm` and dev dependency `drizzle-kit`, then run `npm run db:drizzle:inspect` with `MIGRATION_DATABASE_URL`. Inspect the resulting baseline against the existing database before adopting typed queries. Do not run schema push or create a second production migration history; the optional schema is a query mapping, while SQL remains the constraints/indexes authority.

`/api/v1/health` reports database migration readiness, tutor-authentication configuration, the configured default course, catalogue status, and AI configuration separately. It never presents a configured AI key as proof of a successful provider connection. Source retrieval still works when human-help storage is unavailable.

To run hosted readiness checks, set `VERIFY_BASE_URL` and `ADMIN_PASSWORD` privately and execute `npm run verify:hosted`. This checks the default Savanna answer, equivalent English/Amharic course questions and an off-topic miss. It also signs in as a tutor, creates one labelled test ticket, verifies a real reply through learner authorisation and resolves the ticket. It never prints ticket tokens or session cookies. Record a separate hosted keyboard/voice demo; API checks are not device accessibility evidence.

## Scheduled jobs, monitoring and private media

For serverless delivery, configure `OPS_SECRET` with at least 32 random characters. Schedule an authenticated `POST /api/internal/jobs` every minute using Supabase Cron or another trusted scheduler, with `Authorization: Bearer …`. Each invocation processes bounded channel/webhook work, leases queued items and applies retention. Failed jobs remain retryable. Do not expose the operations secret to a browser or commit it to cron SQL checked into Git. Existing Docker workers remain supported; avoid running competing poll/webhook modes for the same Telegram bot.

For Telegram webhooks, configure `TELEGRAM_BOT_TOKEN` and a `TELEGRAM_WEBHOOK_SECRET` of at least 24 characters. Register the HTTPS `/api/telegram/webhook` URL with Telegram's `secret_token` option. Authenticated private-chat updates are durably queued and deduplicated by update ID, then processed by scheduled jobs. Delivery is at least once: a crash between a side effect and persisting its reply can still duplicate a command or delivery. SMS continues to require its authenticated gateway and outbound adapter.

Set GitHub repository variable `MELA_HEALTH_URL` to the deployed `/api/v1/health` URL to enable the scheduled health workflow. It retries three times before failing the run. Enable GitHub Actions failure notifications for the responsible operators. Scheduled Actions are best-effort monitoring, not a five-minute uptime guarantee; no external alert recipient was configured here.

For reviewed interpreter media on a serverless host, set `SIGNING_STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, server-only `SUPABASE_SECRET_KEY` and `SUPABASE_SIGNING_BUCKET`. Create that bucket privately. Uploads retain MIME/magic-byte validation, hashing and review; authorised playback proxies authenticated storage with byte ranges. Local temporary files are removed after upload. Platform request-size/duration limits still apply: use short clips within the host's upload limit; direct/resumable large-video uploads are not implemented in this pass. No real interpreter recording or fluent-signer validation is supplied.

## Course onboarding and integration choices

`node scripts/build-catalogue.mjs` publishes the three approved public lessons from their authored regions into `data/course-catalogue.json`, `/courses/index.json` and versioned packs. The normal widget build invokes it after regenerating the authored pages. Server retrieval, browser content and download packs share these source sections; superseded fixture copies of these courses are excluded. Legacy Digital Foundations remains explicitly available under its own course context.

`GET /api/v1/courses` lists public pack metadata; `GET /api/v1/courses/{id}` returns an approved pack. The static `/courses` representations are used for offline downloads. `POST /api/v1/content` remains tutor-authenticated indexing for public course material, not a private-LMS entitlement system.

Choose an integration independently of the SDK:

| Option                       | Best fit                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Script tag + Web Components  | Add chat/course media to an existing HTML page                                              |
| Iframe                       | Isolate the companion from host styling; parent-page context is not automatically available |
| REST API + OpenAPI           | Keep a platform-owned interface and backend workflow                                        |
| Webhooks                     | Receive supported events without sharing conversations in event payloads                    |
| Optional SDK / React adapter | Use ready-made components, lifecycle control and optional page actions                      |

SDK additions are `contentUrl`, `actions`, `handle.openActions()` and `handle.downloadUrl`. New fields are optional; existing callers continue to work. Hosts approve their lesson containers and exact API origins, and configure CSP where needed. The assistant's answer text size is adjustable independently of the host page. The supplied course builder uses approved Savanna regions; adding a different platform requires an explicit approved source adapter or published content JSON. It does not scrape authenticated courses or automatically download an entire arbitrary website.

## Run locally

Requires Node.js 22 and PostgreSQL 17, or Docker Compose.

```bash
npm ci
cp .env.example .env
```

Set a tutor `ADMIN_PASSWORD` of at least 12 characters and a random `SESSION_SECRET` of at least 32 characters in `.env`. To generate a secret locally:

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

**Docker:**

```bash
docker compose up --build -d
```

Open http://localhost:3000. Compose waits for PostgreSQL, applies migrations under an advisory lock, seeds demo content without overwriting existing rows, then starts the web application. Public HTTP and database ports bind to localhost. Deployment requires an HTTPS reverse proxy, production secrets, and a strong database password. `docker compose down` preserves the database volume; deleting that volume destroys persisted records.

**Without Docker:** start PostgreSQL, set `DATABASE_URL` in `.env`, then:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Without PostgreSQL, Savanna demo pages, lessons, demo jobs, training and source-backed answers still run. Ticket creation, tutor tools, alert subscriptions and signaling return explicit service-unavailable responses.

## Savanna UI and training lesson

The app now opens the original Savanna self-paced capture instead of the custom MELA dashboard. The original paced, self-paced and concept layouts, styles, fonts, images and interaction scripts were imported from [Savanna-static-pages](https://github.com/AaUel-Knight27/Savanna-static-pages/tree/7e54f6d0fc3728568054fdb58b2d48523bc778ae). Shell Git cloning was blocked by DNS, so the connected GitHub source export was used. `public/savanna/UPSTREAM.json` records the pinned revision. This is a local demo capture, not an authenticated Savanna account or an organiser-verified integration.

- `/` opens `/savanna/pages/homepage-v1-self-paced.html`.
- `/learn` opens `/savanna/pages/concept-with-navigation.html`.
- `/savanna/pages/homepage-v1-paced.html` preserves the working captured week switcher.
- `/savanna/pages/offline-first-localized-ai.html` contains the user-supplied **Offline-First & Localized AI** training session by **Kidus Yohannes · Senior ML Engineer**: 18 English slides, quiz, revealable answer key and slide-level source links.

A prominent training card appears on Savanna homepages and a training link appears in the sidebar. The support panel is docked and open on desktop; smaller screens use the floating launcher. Course UI defaults to English. The older bilingual Digital Foundations demonstration is at `/demo/digital-foundations`.

Ask “What is shaping the future of virtual assistant work?” on the VA concept page, or “What is quantization?” on the training page. The assistant reads only approved lesson regions and the currently displayed module/week. It refreshes scope after those panels change. It cannot read unrelated browser tabs. On a generic host, **Page context** explicitly opts into public main/article text while excluding forms, private nodes and editable fields.

## Gemini, course video and the signing square

Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL` in `.env.local` or your server secret store. The key stays server-side and `.env.local` is ignored by Git. Learners must select the cloud-sharing choice before questions/excerpts go to Gemini. Provider errors display source text with an explicit notice; no working connection is implied by merely configuring a key. Model availability and key validity must be checked against your Google project.

The native provider uses Google's [generateContent API](https://ai.google.dev/api/generate-content). Video input follows the documented [Gemini video-understanding capability](https://ai.google.dev/gemini-api/docs/video-understanding). The model name is configurable; no paid service is required for offline source retrieval.

Each course concept includes a YouTube video box. Load the public example or paste another HTTPS YouTube watch/share/embed URL. Loading connects to YouTube. Select the separate video-sharing choice, then **Generate AI captions**. The server sends the actual video to Gemini and validates timestamped English cues. Cues support seeking, text download, browser-local saving and current-page chat context, with timestamped YouTube citations. Generated transcripts are labelled unreviewed. A text-only training deck is not misrepresented as a session recording.

Generation needs connectivity, a usable key/model, an accessible public video and provider quota. It can fail for long videos or unclear/missing speech; there is no fabricated fallback transcript. Successful server results are cached for one hour in memory; browser-saved public transcripts can be restored offline. YouTube video playback itself is not available offline.

The **learning panel** starts hidden. Click **Show learning panel** for synchronized captions and an animated person beside the lesson (below it on mobile). Choose **Captions + teacher**, **Captions only**, or **Teacher only**. Without an interpreter recording, the MVP uses locally drawn, transcript-driven illustrative gestures, visibly labelled experimental and not EthSL translation. Configure a real `.mp4`/`.webm` interpretation only after fluent-signer review:

```dotenv
SIGN_LANGUAGE_VIDEO_URL=/signing/reviewed-lesson.mp4
SIGN_LANGUAGE_VALIDATED=true
SIGN_LANGUAGE_REVIEWER=your-review-reference
SIGN_LANGUAGE_LESSON_VIDEO_ID=EXACT_11_CHARACTER_YOUTUBE_ID
SIGN_LANGUAGE_OFFSET_SECONDS=0
```

The player shows and synchronizes that clip only for its exact configured YouTube video. Opening the panel during playback joins at the current moment; opening it while paused keeps it paused. Playing, pausing, buffering, seeking, replay and playback rate follow the main player. Hiding pauses only the interpreter. The enlargement dialog preserves the same media and returns keyboard focus when closed. Loading and media errors have explicit status messages and recovery controls; browsers that block playback show **Start interpreter**. Opening uses a subtle transition that respects reduced-motion preferences. For videos without a reviewed interpreter, captions and the experimental gesture preview remain available. No signer clip was supplied; the animated preview demonstrates the interaction and is not a sign-language substitute.

For Docker, configure those variables in `.env` or the deployment environment. Local Next.js also loads `.env.local`; Compose does not automatically read `.env.local`.

## Main demo task

1. Open `/learn` or the offline-first training lesson.
2. Ask an English question about the displayed lesson and follow its source link.
3. Optionally load a YouTube lesson, consent to Gemini transcription, and ask about the resulting English transcript.
4. Choose Talk to a person, review the sharing preview, and confirm the selected information.
5. Open `/dashboard` in another browser context, sign in, and reply to the ticket. The learner’s widget polls every five seconds.
6. The learner may initiate screen sharing; the tutor connects from their workspace. The learner controls stopping capture.

All job listings remain clearly marked demonstrations. Real Savanna account integration, fluent review, browser/screen-reader testing and signing-asset validation remain release gates.

## Embed on another site

```html
<script src="https://YOUR-MELA-HOST/db-assistant.js" defer></script>
<db-assistant
  lang="am"
  api="https://YOUR-MELA-HOST/api"
  content="https://YOUR-MELA-HOST/content.json"
>
</db-assistant>
```

Add the exact host origin to `ALLOWED_ORIGINS`. `api` is the base before `/v1`, so the example calls `/api/v1/ask`. Public widget, optional avatar, and content assets permit cross-origin loading. Chat styles are isolated in Shadow DOM; React and Tailwind are not widget dependencies. The widget build fails above 500,000 bytes. The separate avatar module loads only when requested.

Approve extractable lesson containers using these attributes:

```html
<main
  data-mela-context
  data-course-id="digital-foundations"
  data-course-title="Digital Foundations"
  data-module-title="Module 2"
  data-lesson-title="Using a browser"
>
  <section id="browser-en" data-mela-section lang="en">
    <h2>Using a browser</h2>
    <p data-mela-content>Approved lesson text goes here.</p>
  </section>
</main>
```

Forms, private descendants (`data-private`), navigation, scripts and styles are excluded. Generic pages receive public-catalogue support without scraping arbitrary body content. DOM/navigation changes refresh the retrieval scope and suppress stale requests without clearing the conversation. Host code may dispatch `mela:context-changed` after navigation.

Host events bubble across the shadow boundary:

- `db-assistant:question`: `{ language }`; intentionally excludes question text.
- `db-assistant:escalated`: `{ ticketId }`; excludes ticket token and conversation.

Try `/demo/blank.html`, `/savanna/pages/paced.html`, `/savanna/pages/self-paced.html`, and `/savanna/pages/lesson.html`.

## Knowledge, AI and languages

With `AI_PROVIDER=none`, the default no-key mode, MELA retrieves and quotes relevant public sections, current-page first, with source links. English/Amharic paired fixtures and a small bilingual keyword map support both languages without a model. A retrieval miss offers human help; it never triggers unsupported generation. This is keyword retrieval, not vector search.

Optional providers:

- `local`: set `OLLAMA_URL` and `OLLAMA_MODEL`, and run your Ollama service separately. In Docker, the web service can reach the host through `host.docker.internal`.
- `cloud`: set the full HTTPS chat-completions endpoint in `CLOUD_AI_URL`, plus `CLOUD_AI_KEY` and `CLOUD_AI_MODEL`. The endpoint must support JSON object responses. The learner must check cloud-sharing consent for each widget session. Telegram and SMS never grant cloud consent.

Both providers receive only retrieved evidence and the current question. Invalid citation IDs, provider errors and timeouts fall back to source extracts. Citation validation does **not** prove every generated statement is correct; use the default mode where exact grounding is required. Local model and speech-provider language quality require separate review.

Speech uses browser APIs. The microphone has an explicit confirmation because browser recognition may send audio to the browser vendor. Matching voices, especially `am-ET`, depend on browser/device support. Reliable Amharic speech is not claimed without device validation. No cloud speech credentials or speech server are bundled. Simplify uses the first two source sentences in no-AI mode.

The course visual teacher is generated procedurally and loads only when its panel is visible. Matching surfaces are instanced to reduce GPU draw calls while preserving articulated hands. The chat uses a simpler text/voice interface; the older duplicate decorative chat-avatar control has been removed. Course illustrations are not EthSL translation.

## Offline behavior

The MELA-hosted demo registers `/sw.js` to cache public pages, scripts, and approved content. Visit online and let caching finish before testing offline reload. Admin pages, APIs, screenshots, tickets and conversation history are never cached by this worker. Content updates require connectivity; cached materials can be stale.

On other sites, the widget caches only its configured public knowledge pack in localStorage and searches it plus the current approved page. It does not register a host service worker. Host offline reload is the host’s responsibility. Private or licensed material must not be placed in this public demo pack. First-time offline visits are unsupported.

## Human help and data

Ticket tokens are random, hashed in PostgreSQL, and held only in widget memory. Reloading loses learner ticket access in this demo. Tutor sessions are signed, HttpOnly, SameSite=Strict cookies lasting eight hours. Tutor mutation routes require the configured application origin. The tutor password is an environment secret; there is no multi-user role-management system.

Sharing conversation/context is opt-in with a preview. Screenshots accept PNG, JPEG and WebP up to 2 MiB; tutor-only retrieval checks authentication and bypasses caches. Image magic-byte checking is not malware scanning. Screen sharing uses authenticated HTTP signaling and WebRTC, expires after 30 minutes, and stops when capture stops or the ticket is resolved. Cross-network connections may need STUN/TURN. Android capture depends on browser support; screenshot/context alternatives remain available.

The alert worker removes tickets older than `RETENTION_DAYS` (default 30) and old signaling sessions. The public demo catalogue has no LMS identity or course entitlements; index only public materials. Rate limits are per process; configure a trusted edge limiter for multi-instance deployment. Enable `TRUST_PROXY=true` only behind a proxy that sanitizes forwarded headers.

## Telegram, SMS and career gateway

Telegram needs `TELEGRAM_BOT_TOKEN`. Start the optional services:

```bash
docker compose --profile telegram --profile channels up --build -d
```

The bot handles private chats only. Commands: `/start`, `/am`, `/en`, `/help`, `/confirmhelp`, `/alerts keyword`, `/stop`. `/start` displays the chat ID for web alert verification. Telegram polling offsets and preferences persist in PostgreSQL. One Telegram worker and one alert worker are intended for this demo.

The low-bandwidth gateway accepts authenticated JSON:

```bash
curl http://localhost:3000/sms/inbound \
  -H "Authorization: Bearer YOUR_SMS_INBOUND_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"from":"+251911000000","text":"How do I use a browser?"}'
```

Set `SMS_INBOUND_SECRET` to at least 24 characters. Replies, including errors, are plain text capped at 160 Unicode codepoints. Amharic may require multiple carrier SMS segments. Your gateway must authenticate the sender and deliver the returned text. Commands include `HELP`, `CONFIRMHELP`, `AM`, `EN`, `VERIFY 123456`, and `STOP`.

Outbound SMS is a generic HTTPS adapter: configure `SMS_API_URL` and `SMS_API_KEY`. It sends JSON `{ "to": "+251...", "text": "..." }` with a bearer token. If your vendor differs, adapt `lib/channels/transports.ts`; no vendor account is provisioned.

Web alerts verify destination ownership using a six-digit code expiring in ten minutes. Telegram `/alerts` uses the already authenticated chat. No alerts send before verification. Subscriptions can be stopped in the chosen channel or with their bearer token. The worker deduplicates subscription/job pairs, leases work, and retries failed delivery up to five times. Delivery is at least once: a crash after sending but before marking success can duplicate a message. Interview accommodation requests create a tutor ticket; they do not contact an employer.

## Screen-sharing relay

Same-network connections may work without a relay. Configure `STUN_URL` and/or `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` for other networks. The optional `turn` Compose profile starts coturn; public use needs correct public/external IP configuration, firewall rules, TLS where appropriate, and secret rotation. Static TURN credentials are shared with authorized session participants; replace with short-lived credentials before public scale.

## Webhooks and API

`/docs` provides a quick guide; `/openapi.yaml` provides the full API contract. Authenticated tutors can register a webhook only on an HTTPS host listed in `WEBHOOK_ALLOWED_HOSTS`. Receivers get the ticket ID and event name, never conversation content. No redirects are followed. Restrict deployment egress as additional protection against DNS rebinding.

Verify `X-Mela-Signature` against HMAC-SHA256 of `X-Mela-Timestamp + "." + exact request body`, reject old timestamps, and deduplicate `X-Mela-Delivery`. Secrets stay server-side except the one-time registration response. The alert worker handles delivery, capped at five attempts. Query delivery tables to inspect exhausted retries. `/api/v1/health` returns 503 when PostgreSQL/migrations are unavailable.

## Validation

```bash
npm run typecheck
npm test
npm run test:widget
npm run test:integration
npm run test:features
npm run extension:build
npm run build
npx playwright install chromium
npm run test:e2e
```

For database tests, use a separate disposable database, migrate it, then set `TEST_DATABASE_URL` and run `npm run test:db`. Set `E2E_DB=1` to include the browser ticket/reply test; the running server needs a migrated/seeded database and matching `ADMIN_PASSWORD`. CI provisions PostgreSQL and runs these checks, including axe critical/serious checks.

See `CONFORMANCE.md` for the manual release gate and `BUILD_STATUS.md` for what was actually verified in this workspace. Automated checks do not substitute for a co-designer completing the task unaided.

## GitHub checkpoints

Work is committed as logical changes, with a push attempted every three commits. The intended remote is the private `FuadTesfaye/mela-ai` repository. If repository creation or authentication is unavailable, commits remain local; no successful push should be inferred. After restoring GitHub access, create the private repository if needed and push `main`. Never force-push.

The event brief requires the licence named at kickoff. No licence is invented here; add the organiser’s actual licence and any team attribution before submission.

## Video teaching and signing studio

Every course player now defaults to `https://www.youtube.com/watch?v=9hE5-98ZeCg` (Google for Developers: Building with Gemini 2.0 — Multimodal live streaming, 149 seconds). Change this once in `data/lesson-media.json`. Open `/savanna/pages/programming-for-beginners.html` for the course demo. The separate Offline-First & Localized AI session retains all 18 supplied slides. Load the public video and explicitly consent to English transcription; generated transcripts may contain errors and should be reviewed against the source. The assistant can use the lesson, whole transcript, or a frozen timestamp. **Explain this moment** pauses playback. Choose a simple explanation, example, steps or a diagram; diagrams have readable text equivalents and an enlarged view. Saving an explanation is explicit; **Saved explanations** lets you read or remove these browser-local answers offline. This does not download YouTube videos or AI models.

**Include on-screen visuals** additionally requires cloud consent and Gemini. It sends the actual public video URL with a roughly 30-second segment around the captured timestamp; transcript-only answers do not establish what is visible on screen. Provider errors fall back transparently to retrieved source text. Model output is bounded JSON; graphs are drawn by local code, never executed model markup.

Tutors can open `/dashboard/signing`, sign in with the existing tutor password, and record a real EthSL interpreter alongside the source or upload a complete MP4/WebM. Camera access is learner initiated; audio is not recorded. Uploads stream to private disk (128 MiB maximum), with metadata in PostgreSQL. Run migrations before using the studio. Docker Compose persists files in `mela-signing`; back up this volume together with the database. Local development uses `SIGNING_STORAGE_DIR` or `data-runtime/signing`, excluded from Git. Reverse proxies must permit uploads of this size and a suitable upload timeout.

Draft → awaiting review → approved/rejected. A separate declared fluent reviewer must check meaning, visible hands/face, timing, and full coverage. Shared tutor authentication records these declarations; it does not verify identity, fluency or actual video duration. Review the full recording and confirm durations manually, especially for WebM files without reliable duration metadata. Approval replaces the previous approved track for that exact lesson/video; **Unpublish** removes public access. Draft media requires the tutor cookie, while approved media supports public byte-range playback. The lesson square synchronizes playback, supports hiding, and can be enlarged. No real signer recording has been supplied yet. The MVP panel instead offers AI captions and illustrative avatar gestures; a reviewed recording takes priority when published. There is no automatic English-to-EthSL translation.

Camera capture pauses with source playback and stops after 20 minutes. Longer interpretations should be uploaded as compressed files. A crashed upload can be retried after ten minutes through the media API; incomplete `.part` files may need operator cleanup after a process crash. Published files are served through the API, never a public filesystem directory.

## MVP captions and animated preview

1. Load the course video and choose **Show learning panel**.
2. Check the public-video sharing choice and click **Generate AI captions** (also available inside the panel).
3. Play, pause, or seek: the current English cue and avatar pose follow the source clock. Select captions, avatar, or both; enlarge the panel for a larger view.

Captions come from the actual video through Gemini's [documented YouTube input](https://ai.google.dev/gemini-api/docs/video-understanding). Successful captions are saved locally and can be restored offline. Network, key or quota failures are displayed in the panel with a retry control; words are never invented as a fallback.

The default visual teacher is a stylized 3D person with two articulated hands, per-finger joints, head gaze and coordinated concept gestures. Eight hand-authored segments for the selected video pair gestures with readable diagrams and source timestamps. These are visual explanations, not ASL/EthSL translation. Other videos retain caption-following illustrative motion without inventing a lesson storyboard. Experimental English fingerspelling and a 2D illustration remain optional modes; their handshapes need fluent review. Reviewed interpreter recordings still take priority.

Hand movement is driven by individual transcript cues. Local keyword rules choose pointing, comparison, connection, counting or a general explanation; the authored segment supplies a fallback concept. Each cue has its own prepare/hold/return timing, and long cues repeat a short bounded cycle. Both wrists and finger joints move visibly; speech gaps use a rest pose. Seeking reconstructs the same pose, playback speed changes its pace, and pause freezes it. These rules illustrate English captions; they do not translate sign-language grammar or infer exact signs from speech.

**Explain this moment** pauses the video and opens a larger teacher, caption, diagram and explanation. **Replay demonstration** runs a separate four-second gesture demonstration at 0.5×, 0.75× or 1× while the video stays paused. **Resume lesson** returns to the captured moment and continues playback. Seeking or changing videos clears a stale explanation. Front, Hands focus and Reset view keep both hands visible.

The Three.js renderer loads only when the visible teacher panel needs it. Adaptive graphics respects data saving; select **Try 3D** to opt in or **2D illustration** to avoid the download. WebGL/download failures preserve captions and the SVG fallback. Reduced motion keeps a static pose until **Enable animation** is selected. Hidden/offscreen panels stop updates, and disposal releases GPU resources. The procedural character uses project-owned geometry with no external models/textures; Three.js is MIT licensed.

`npm run widget:build` produces `/avatar/teacher-3d.js` and `/avatar/storyboard.json` separately from the SDK. The build enforces an initial SDK below 100,000 bytes and a 3D runtime below 250,000 gzip bytes. The service worker caches these optional assets only after they are requested. Device frame rate and visual comprehension still need testing with learners on real hardware.

## Prepare the selected video's source captions

The selected video already has an English caption track. Preparing it avoids waiting for Gemini when demonstrating the MVP:

```sh
python3 -m venv .venv-video
.venv-video/bin/pip install -r scripts/requirements-video.txt
.venv-video/bin/python scripts/prepare-video.py
npm run dev
```

The preparation script fetches the selected video's English captions and normalizes overlapping cue boundaries. Its JSON cache is local and excluded from Git; repeat the preparation step on a new deployment if you want instant demo captions. It is served at `/transcripts/9hE5-98ZeCg.json` and checked against the exact selected video before display. The current workspace has 53 source cues prepared. These captions are identified as source captions, rather than freshly generated AI text. Without the cache, the existing consented Gemini option remains available. Python is only an optional preparation tool, not part of the SDK or web runtime.

Use **Load YouTube video → Show learning panel → Play lesson**. Play/Pause and speed controls follow the real YouTube clock. If motion is reduced by your system settings, choose **Enable animation** explicitly. Caption tools remain available for retranscription. Optional English fingerspelling is a preview based on the [CDC/Cleary School manual-alphabet chart](https://www.cdc.gov/hearing-loss-children-guide/media/pdfs/fingerspelling.pdf), with estimated within-cue word timing and no claim of full sign-language translation.

## Embed on another website

See [the SDK guide](packages/sdk/README.md) for the single-script custom elements, JavaScript API, React adapter, local npm tarball, iframe wrapper, lifecycle methods, and explicit context scope. Examples run at `/demo/sdk.html` (plain HTML) and `/embed` (React/iframe wrapper). The host website may use any server language; only browser JavaScript/HTML is required. Add its exact origin to the MELA backend's `ALLOWED_ORIGINS`.

```html
<script src="https://mela.example/mela-sdk.js" defer></script>
<mela-course-media
  api="https://mela.example/api"
  video-src="https://www.youtube.com/watch?v=9hE5-98ZeCg"
>
</mela-course-media>
```

Or use an isolated wrapper:

```html
<iframe
  src="https://mela.example/embed?video=9hE5-98ZeCg"
  title="MELA learning companion"
  width="100%"
  height="900"
  allow="autoplay; fullscreen"
  allowfullscreen
></iframe>
```

Direct embedding needs the host CSP to permit the chosen SDK scripts, API connections, YouTube frames and component styles. The iframe option isolates the companion from host styles; the host still needs to allow that frame origin. The iframe cannot read parent-page lesson text.

## Reading mode and screen readers

The chat keeps language, Reading mode, conversation, Send, microphone and human help accessible. Extra context/format/saved-answer controls are under **Learning options**. Cloud sharing remains an explicit choice beside the composer. Touch buttons and language controls have a 44px minimum height; keyboard focus and forced colors remain visible.

Choose **Reading mode** for larger answer text and expanded diagram descriptions. It remembers `mela-reading-mode` in this browser's storage when available. The preference is not sent to the AI or used to infer disability. It works without detecting a screen reader. Chat answers use a labelled polite `log` with additions-only updates and a busy state while an answer is being assembled. Answers do not steal focus or automatically start synthesized speech; **Listen** is optional.

Websites cannot reliably determine blindness or detect TalkBack through a standard browser API. The [W3C design principles](https://www.w3.org/TR/design-principles/) advise keeping assistive-technology use private. [W3C's chat-log technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA23) informs the message announcements, and [Google's Android overview](https://support.google.com/accessibility/android/answer/6006564?hl=en) describes TalkBack's touch and spoken feedback. Actual Android/TalkBack testing is still required; browser accessibility checks are not a substitute.

For a device check: enable TalkBack, open the lesson in Chrome, swipe to Ask MELA and double-tap, enable Reading mode, submit a question, verify the complete answer and source links are announced, explore Diagram as text, then close the chat and confirm focus returns to Ask MELA. Repeat with reading mode off, large text and a hardware keyboard if available.

The 3D renderer uses [Three.js instancing](https://threejs.org/docs/pages/InstancedMesh.html) for repeated geometry/materials, following its [optimization guidance](https://threejs.org/manual/pages/optimize-lots-of-objects.html). A measured front-view frame now uses 16 draw calls versus 111 previously (about 86% fewer), with the same 16,384 triangles. This reduces GPU submission work; it does not guarantee a particular frame rate on every device or speed up the source video.

### Browser-first English and Amharic

Ordinary lesson questions now use browser-side retrieval by default. Choose አማርኛ for a prepared Amharic lesson reader, new source-backed answers and synchronized captions for the selected demo video. Microphone input produces editable text before sending, with a consented Gemini recording fallback where native dictation is unavailable. New AI requests use a private server relay.

See [browser-first setup and limits](docs/BROWSER_FIRST.md), [the project slides](docs/presentation/MELA-AI-Project-Overview.pptx) and [the hosted demo](https://mela-ai-wheat.vercel.app/savanna/pages/homepage-v1-self-paced.html).

# MELA AI

**A little support. A world of possibility.** An accessible English/Amharic learning companion for Digital Bridge Track 3, integrated into the original Savanna static UI.

Next.js powers the learner workspace, tutor portal, and APIs. An independent TypeScript Web Component provides chat on plain HTML or another LMS. PostgreSQL persists consented support requests and channel preferences. No AI key is needed for the default source-extraction mode.

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

Each course concept includes a YouTube video box. Load the public example or paste another HTTPS YouTube watch/share/embed URL. Loading connects to YouTube. Select the separate video-sharing choice, then **Generate English transcript**. The server sends the actual video to Gemini and validates timestamped English cues. Cues support seeking, text download, browser-local saving and current-page chat context, with timestamped YouTube citations. Generated transcripts are labelled unreviewed. A text-only training deck is not misrepresented as a session recording.

Generation needs connectivity, a usable key/model, an accessible public video and provider quota. It can fail for long videos or unclear/missing speech; there is no fabricated fallback transcript. Successful server results are cached for one hour in memory; browser-saved public transcripts can be restored offline. YouTube video playback itself is not available offline.

The **EthSL signing panel** starts hidden. Click **Show signing panel** to load the reviewed interpreter beside the lesson (below it on mobile). Configure a real `.mp4`/`.webm` interpretation only after fluent-signer review:

```dotenv
SIGN_LANGUAGE_VIDEO_URL=/signing/reviewed-lesson.mp4
SIGN_LANGUAGE_VALIDATED=true
SIGN_LANGUAGE_REVIEWER=your-review-reference
SIGN_LANGUAGE_LESSON_VIDEO_ID=EXACT_11_CHARACTER_YOUTUBE_ID
SIGN_LANGUAGE_OFFSET_SECONDS=0
```

The player shows and synchronizes that clip only for its exact configured YouTube video. Opening the panel during playback joins at the current moment; opening it while paused keeps it paused. Playing, pausing, buffering, seeking, replay and playback rate follow the main player. Hiding pauses only the interpreter. The enlargement dialog preserves the same media and returns keyboard focus when closed. Loading and media errors have explicit status messages and recovery controls; browsers that block playback show **Start interpreter**. Opening uses a subtle transition that respects reduced-motion preferences. For other videos, it clearly states that no validated signing clip is connected. No signer clip was supplied, so signing is currently unavailable; an avatar is not used as a sign-language substitute.

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

The optional WebGL human character is generated procedurally, needs no downloaded asset, and moves its mouth during browser speech. It is not EthSL translation. No EthSL animations are enabled without fluent-signer validation and asset/reviewer metadata.

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
npm run build
npx playwright install chromium
npm run test:e2e
```

For database tests, use a separate disposable database, migrate it, then set `TEST_DATABASE_URL` and run `npm run test:db`. Set `E2E_DB=1` to include the browser ticket/reply test; the running server needs a migrated/seeded database and matching `ADMIN_PASSWORD`. CI provisions PostgreSQL and runs these checks, including axe critical/serious checks.

See `CONFORMANCE.md` for the manual release gate and `BUILD_STATUS.md` for what was actually verified in this workspace. Automated checks do not substitute for a co-designer completing the task unaided.

## GitHub checkpoints

Work is committed as logical changes, with a push attempted every three commits. The intended remote is the private `FuadTesfaye/mela-ai` repository. If repository creation or authentication is unavailable, commits remain local; no successful push should be inferred. After restoring GitHub access, create the private repository if needed and push `main`. Never force-push.

The event brief requires the licence named at kickoff. No licence is invented here; add the organiser’s actual licence and any team attribution before submission.

## Video teaching and EthSL studio

Open `/savanna/pages/programming-for-beginners.html` for the selected YouTube lesson (`bJzb-RuUcMU`). The separate Offline-First & Localized AI session retains all 18 supplied slides. Load the public video and explicitly consent to English transcription; generated transcripts may contain errors and should be reviewed against the source. The assistant can use the lesson, whole transcript, or a frozen timestamp. **Explain this moment** pauses playback. Choose a simple explanation, example, steps or a diagram; diagrams have readable text equivalents and an enlarged view. Saving an explanation is explicit; **Saved explanations** lets you read or remove these browser-local answers offline. This does not download YouTube videos or AI models.

**Include on-screen visuals** additionally requires cloud consent and Gemini. It sends the actual public video URL with a roughly 30-second segment around the captured timestamp; transcript-only answers do not establish what is visible on screen. Provider errors fall back transparently to retrieved source text. Model output is bounded JSON; graphs are drawn by local code, never executed model markup.

Tutors can open `/dashboard/signing`, sign in with the existing tutor password, and record a real EthSL interpreter alongside the source or upload a complete MP4/WebM. Camera access is learner initiated; audio is not recorded. Uploads stream to private disk (128 MiB maximum), with metadata in PostgreSQL. Run migrations before using the studio. Docker Compose persists files in `mela-signing`; back up this volume together with the database. Local development uses `SIGNING_STORAGE_DIR` or `data-runtime/signing`, excluded from Git. Reverse proxies must permit uploads of this size and a suitable upload timeout.

Draft → awaiting review → approved/rejected. A separate declared fluent reviewer must check meaning, visible hands/face, timing, and full coverage. Shared tutor authentication records these declarations; it does not verify identity, fluency or actual video duration. Review the full recording and confirm durations manually, especially for WebM files without reliable duration metadata. Approval replaces the previous approved track for that exact lesson/video; **Unpublish** removes public access. Draft media requires the tutor cookie, while approved media supports public byte-range playback. The lesson square synchronizes playback, supports hiding, and can be enlarged. No real signer recording has been supplied yet: the square honestly remains unavailable until one is reviewed. There is no automatic English-to-EthSL gesture generation.

Camera capture pauses with source playback and stops after 20 minutes. Longer interpretations should be uploaded as compressed files. A crashed upload can be retried after ten minutes through the media API; incomplete `.part` files may need operator cleanup after a process crash. Published files are served through the API, never a public filesystem directory.

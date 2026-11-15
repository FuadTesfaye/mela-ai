# MELA AI

**A little support. A world of possibility.** An accessible English/Amharic learning companion for Digital Bridge Track 3.

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

Without PostgreSQL, the workspace, lessons, demo jobs, and source-backed answers still run. Ticket creation, tutor tools, alert subscriptions and signaling return explicit service-unavailable responses.

## Main demo task

1. Open `/learn` or any `/savanna/pages/*.html` fixture.
2. Open MELA and ask “How do I keep a password safe?” or select Amharic and ask “የይለፍ ቃል”.
3. Follow a citation. Select Listen if the device has a matching voice; text remains available.
4. Choose Talk to a person. Review and select the conversation/context to share, optionally attach a screenshot, and confirm consent.
5. Open `/dashboard` in another browser context and sign in with the tutor password. Reply to the ticket. The learner’s open widget polls for replies every five seconds.
6. The learner may start screen sharing and select a window through the browser picker. The tutor selects Connect to shared screen. The learner can stop immediately; no media is recorded.

The provided Savanna pages are **representative fixtures**, not the official starter. Real starter integration must be verified when those files become available. All job listings and employers are clearly marked demonstrations.

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

Default `AI_PROVIDER=none` retrieves and quotes relevant public sections, current-page first, with source links. English/Amharic paired fixtures and a small bilingual keyword map support both languages without a model. A retrieval miss offers human help; it never triggers unsupported generation. This is keyword retrieval, not vector search.

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

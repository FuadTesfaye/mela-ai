# Build and verification status

Recorded 15 November 2026. This describes the local implementation and observed checks, not a production deployment or accessibility certification.

## Delivered

- Responsive learner workspace, bilingual lesson UI, human support, career space, tutor portal and developer guide.
- Independent Shadow DOM Web Component with English/Amharic strings, current-page retrieval, source links, offline fallback, optional browser voice and optional lazy-loaded WebGL character.
- PostgreSQL schemas/migrations, consented support tickets, tutor replies, private screenshots, authenticated screen-sharing signaling, and learner-controlled capture code.
- No-key extractive answers plus optional Ollama/cloud providers, with retrieval gating and explicit cloud consent.
- Telegram polling, authenticated plain-text gateway, destination-verified job alerts, delivery workers, interview accommodation tickets, signed webhook delivery and retention cleanup.
- Docker Compose, CI workflow, OpenAPI, installation instructions and an honest conformance inventory.

## Checks actually completed

| Check                                                                | Result                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| TypeScript route generation and type checking                        | Passed                                                                           |
| Retrieval/security/channel unit tests                                | 17 passed                                                                        |
| Widget DOM tests using the real bundled component and answer handler | 6 passed                                                                         |
| HTTP Route Handler integration tests                                 | 9 passed                                                                         |
| Production build                                                     | Passed with Next.js webpack and compiler-API type checking                       |
| Widget size gate                                                     | Passed: 29,595 bytes uncompressed; 10,243 gzip bytes                             |
| Separate optional avatar module                                      | 3,012 bytes uncompressed; 1,450 gzip bytes                                       |
| Docker Compose configuration                                         | `docker compose config --quiet` passed with temporary validation values          |
| OpenAPI structure                                                    | YAML parsed; all 152 local schema references resolved across 16 API paths        |
| Cross-site public assets                                             | Built route manifest declares CORS on widget, avatar, content and OpenAPI assets |

The final production build uses webpack because a fresh Turbopack CSS transform attempted an internal socket blocked by this environment. Next.js uses TypeScript's compiler API to avoid restricted subprocess-output handling. These are normal supported build paths; no type checks are disabled.

## Verification blocked or pending

- The local development server cannot bind its port (`listen EPERM`). No running preview URL is claimed.
- Chromium fails to launch under the sandbox's socket restrictions. Playwright/axe, visual layout, WebGL, keyboard focus, 200% zoom, 320px reflow, real offline reload and screen-reader checks require a browser-capable environment.
- Docker daemon access is denied. Compose syntax was validated, but containers, PostgreSQL migrations and real ticket/reply/media flows could not be exercised here.
- The PostgreSQL integration test is provided and skipped without TEST_DATABASE_URL. CI is configured to provision PostgreSQL and run it; no CI run is claimed.
- Telegram, SMS, cloud AI, Ollama and TURN need configured services. No external message delivery or provider quality is claimed.
- Savanna integration uses approved representative fixtures. Official starter verification, fluent Amharic review, co-designer validation and any licensed/validated EthSL assets remain external inputs.

## GitHub checkpoints

The intended destination is the private `FuadTesfaye/mela-ai` repository. Local commits preserve each logical change. Repository creation and pushes were attempted at three-commit checkpoints, but GitHub DNS/network access failed and the local GitHub CLI account also reports invalid credentials. The initial push additionally had no remote because repository creation had failed; the intended origin is now configured.

**No successful GitHub write has been verified.** Restore network access and GitHub authentication, create the private repository if it does not exist, then push the existing main branch without force. All source and history remain in this checkout.

## Release gate

Follow CONFORMANCE.md with the co-designer, run the database/browser/Compose checks in an unrestricted environment, configure and test channel delivery and relay services, supply the organiser's required licence, and resolve observed failures before calling this production-ready.

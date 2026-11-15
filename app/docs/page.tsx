import Link from "next/link";
import Shell from "@/components/Shell";
export default function Docs() {
  return (
    <Shell title="Help & resources">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE GUIDANCE</div>
          <h1>
            Make this space <em>yours.</em>
          </h1>
          <p>Simple ways to learn, connect, and keep moving.</p>
        </div>
      </div>
      <div className="prose">
        <section className="content-card">
          <h2>Start with a question.</h2>
          <p>
            Open MELA using the green button. Choose English or አማርኛ, type your
            question, and select Send. MELA looks for relevant lesson text and
            links to its sources. If a source is missing, it says so and offers
            human help.
          </p>
          <p>
            Use Tab to move between controls, Enter to activate buttons, and
            Escape to close the chat. Use Shift + Enter for a new line in your
            message. New answers are announced to screen readers.
          </p>
        </section>
        <section className="content-card">
          <h2>Read it. Hear it. Ask again.</h2>
          <p>
            Select Listen to hear an answer when your device has a matching
            voice. Stop audio is always available. Microphone support depends on
            your browser and language; a confirmation explains that your browser
            may send audio to its speech service. English and Amharic text
            remain available.
          </p>
          <p>
            Simplify selects the first two sentences from each retrieved section
            in no-AI mode. Optional AI providers can explain those sources in
            simpler language; generated explanations still require review.
          </p>
        </section>
        <section className="content-card">
          <h2>Get a helping hand.</h2>
          <p>
            Select Talk to a person, review the sharing preview, and confirm.
            Sharing the conversation, page context, or a screenshot is optional.
            Keep the chat open for tutor replies. The ticket access token is
            held in memory, so reloading loses access to that ticket in this
            demo.
          </p>
          <p>
            After creating a ticket, choose Share screen to select a screen or
            window through your browser. The tutor must connect from their
            authenticated workspace. Use Stop sharing or the browser’s stop
            control at any time. Unsupported devices can share context or
            screenshots instead.
          </p>
          <Link href="/support">Explore human support →</Link>
        </section>
        <section className="content-card" id="offline">
          <h2>Keep learning with less connection.</h2>
          <p>
            Visit these public demo pages while online to save their content.
            The MELA-hosted demo registers an offline worker for public pages
            and assets. Once caching completes, previously saved pages can
            reload offline. First-time offline visits, tutor replies, external
            messages, and cloud services require a connection.
          </p>
          <p>
            On another website, the widget searches the public content pack
            saved in that browser and current approved page content. The host
            controls whether its own pages work offline. MELA does not install a
            service worker on the host’s behalf or cache private conversations.
          </p>
          <Link href="/demo/blank.html">Try the plain HTML demo →</Link>
        </section>
        <section className="content-card">
          <h2>For platforms and developers</h2>
          <p>
            The learner widget runs independently of React, Tailwind, or
            Savanna. Demo Savanna pages are representative fixtures, not the
            official starter. Use the same script and component installation on
            all supported hosts.
          </p>
          <pre>
            <code>{`<script src="https://YOUR-MELA-HOST/db-assistant.js" defer></script>
<db-assistant
  lang="am"
  api="https://YOUR-MELA-HOST/api"
  content="https://YOUR-MELA-HOST/content.json">
</db-assistant>`}</code>
          </pre>
          <p>
            Configure your host origin on the server. The script requires DOM
            access to approved lesson sections; add data-mela-context and
            data-mela-section attributes without modifying host scripts.
          </p>
          <div className="meta-row">
            <a href="/openapi.yaml">OpenAPI specification</a>
            <Link href="/savanna/pages/paced.html">Paced fixture</Link>
            <Link href="/savanna/pages/self-paced.html">
              Self-paced fixture
            </Link>
            <Link href="/savanna/pages/lesson.html">Lesson fixture</Link>
          </div>
        </section>
        <section className="content-card">
          <h2>What’s a demo, and what’s ready to connect?</h2>
          <p>
            Course text and jobs are demonstration materials. Telegram, SMS,
            cloud AI, and TURN need configured services. The optional procedural
            3D speaking character is a presentation aid; it does not translate
            Ethiopian Sign Language. EthSL clips are disabled until validated
            assets are supplied.
          </p>
          <p>
            Accessibility testing with real learners, NVDA, and TalkBack remains
            a release gate. Automated tests alone do not establish WCAG
            conformance.
          </p>
        </section>
      </div>
    </Shell>
  );
}

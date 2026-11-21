import Link from "next/link";
import Shell from "@/components/Shell";
export const metadata = { title: "Integrate MELA" };
const MELA = "https://mela-ai-wheat.vercel.app";
const scriptTag = `<script src="${MELA}/mela-sdk.js" defer></script>
<db-assistant
  api="${MELA}/api"
  content="${MELA}/content.json"
  lang="om"
></db-assistant>`;
const voicePanel = `<script src="${MELA}/actions.js"></script>
<script>
  MelaActions.mountActions({
    api: "${MELA}/api/v1",
    assistant: true,      // big Talk button + chat
    speakAnswers: true,   // read answers aloud
    language: "om",       // en | am | om | ti
  });
</script>`;
const callbacks = `const API = "${MELA}/api/v1";
MelaActions.mountActions({
  api: API, assistant: true, speakAnswers: true, language: "om",
  question: async (question, language) => {
    const r = await fetch(API + "/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, language, cloudConsent: true }),
    });
    const d = await r.json();
    return { status: "done", message: d.answer, sources: d.sources };
  },
  tts: async (text, language) => {   // returns base64 WAV
    const r = await fetch(API + "/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    const b = new Uint8Array(await r.arrayBuffer());
    let s = ""; for (const x of b) s += String.fromCharCode(x);
    return btoa(s);
  },
});`;
const react = `import { MelaCompanion } from "@mela-ai/sdk/react";

<MelaCompanion api="${MELA}/api" language="om" assistant />`;
const curl = `curl -X POST ${MELA}/api/v1/tts \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Akkam jirta?","language":"om"}' --output hello.wav`;
const agentPrompt = `Read ${MELA}/skills/mela-integrate/SKILL.md and add MELA to this website.`;
const api: [string, string, string][] = [
  ["/api/v1/ask", "{ question, language, cloudConsent }", "{ answer, sources }"],
  ["/api/v1/tts", "{ text, language }", "audio/wav"],
  ["/api/v1/speech", "{ audio, mimeType, language, consent }", "{ text }"],
];
export default function Integrate() {
  return (
    <Shell title="Integrate MELA">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DEVELOPER DOCS</div>
          <h1>
            Add MELA to any website. <em>In minutes.</em>
          </h1>
          <p>
            MELA answers out loud in English, አማርኛ, Afaan Oromoo and ትግርኛ, with
            captions and a sign-language visual aid. Pick the option that fits.
          </p>
        </div>
      </div>
      <div className="prose">
        <section className="content-card">
          <h2>🤖 AI agent skill</h2>
          <p>
            MELA comes with an AI skill. Coding agents (Claude Code, Cursor and
            others) can read it and add MELA to your website for you. Just ask
            your agent:
          </p>
          <pre>
            <code>{agentPrompt}</code>
          </pre>
          <p>
            <a href="/skills/mela-integrate/SKILL.md" download>
              Download SKILL.md
            </a>{" "}
            · For Claude Code, save it as{" "}
            <code>.claude/skills/mela-integrate/SKILL.md</code> in your project.
          </p>
        </section>
        <section className="content-card">
          <h2>1. Browser extension (no code)</h2>
          <p>
            For users who want MELA on every website. It opens by itself,
            greets out loud and remembers the language.{" "}
            <Link href="/extension/guide">Read the extension guide →</Link>
          </p>
        </section>
        <section className="content-card">
          <h2>2. One script tag (any website)</h2>
          <p>Works with HTML, PHP, WordPress, Django, Rails and more.</p>
          <pre>
            <code>{scriptTag}</code>
          </pre>
        </section>
        <section className="content-card">
          <h2>3. Voice panel (&ldquo;Talk to this website&rdquo;)</h2>
          <p>
            The same panel as the extension. Press <kbd>Ctrl+Shift+M</kbd> to
            talk. On its own it runs page commands by voice (scroll, read,
            click). Add the <code>question</code> and <code>tts</code> callbacks
            for AI answers and Ethiopian voices (example below).
          </p>
          <pre>
            <code>{voicePanel}</code>
          </pre>
          <p>Connect AI answers and natural voices:</p>
          <pre>
            <code>{callbacks}</code>
          </pre>
        </section>
        <section className="content-card">
          <h2>4. React / Next.js</h2>
          <pre>
            <code>{react}</code>
          </pre>
        </section>
        <section className="content-card">
          <h2>5. REST API</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">POST</th>
                <th scope="col">Send</th>
                <th scope="col">Get</th>
              </tr>
            </thead>
            <tbody>
              {api.map(([path, body, out]) => (
                <tr key={path}>
                  <td>
                    <code>{path}</code>
                  </td>
                  <td>
                    <code>{body}</code>
                  </td>
                  <td>{out}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Try the Afaan Oromoo voice:</p>
          <pre>
            <code>{curl}</code>
          </pre>
          <p>
            Full spec: <a href="/openapi.yaml">openapi.yaml</a>
          </p>
        </section>
        <section className="content-card">
          <h2>Server keys (self-hosting)</h2>
          <ul>
            <li>
              <code>ADDIS_API_KEY</code>: Amharic, Afaan Oromoo, Tigrinya
            </li>
            <li>
              <code>GROQ_API_KEY</code>: fast English (optional)
            </li>
            <li>
              <code>GEMINI_API_KEY</code>: backup (optional)
            </li>
            <li>
              <code>ALLOWED_ORIGINS</code>: every site that embeds MELA
            </li>
          </ul>
          <p>Keys live on the server only. Never put them in browser code.</p>
        </section>
      </div>
    </Shell>
  );
}

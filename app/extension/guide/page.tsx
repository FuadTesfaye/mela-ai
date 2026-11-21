import Shell from "@/components/Shell";
export const metadata = { title: "MELA extension guide" };
const shortcuts: [string, string][] = [
  ["Ctrl + Shift + M (⌘ + Shift + M on Mac)", "Start or stop talking to MELA"],
  ["Alt + Shift + M", "Open MELA on the current page"],
  ["Say “speak Oromo”, “Amharic”, “English”", "Switch language by voice"],
  ["Say “stop” or “nagaatti”", "Stop hands-free (Jarvis) mode"],
];
const languages: [string, string, string, string][] = [
  ["English", "Groq Whisper", "Groq", "Device voice → Groq → Gemini"],
  ["Amharic (አማርኛ)", "Addis AI", "Addis AI", "Addis AI “Hamen”"],
  ["Afaan Oromoo", "Addis AI", "Addis AI", "Addis AI “Bikila”"],
  ["Tigrinya (ትግርኛ)", "Addis AI", "Gemini", "Addis AI “Berhane”"],
];
export default function ExtensionGuide() {
  return (
    <Shell active="Chrome extension" title="Extension guide">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MELA EXTENSION · QUICK GUIDE</div>
          <h1>
            Open it once. <em>It stays with you and talks.</em>
          </h1>
          <p>
            MELA is built so a blind user never has to look for it. After the
            first time you open it, it opens by itself on every website, reads
            its greeting out loud and remembers your language.
          </p>
          <a className="button primary" href="/downloads/mela-extension.zip">
            Download the extension (.zip)
          </a>
        </div>
      </div>
      <div className="cards-grid">
        <section className="content-card">
          <h2>1. Install</h2>
          <ol>
            <li>Unzip mela-extension.zip.</li>
            <li>
              Open <code>chrome://extensions</code>, turn on Developer mode,
              click Load unpacked and choose the folder.
            </li>
            <li>Pin MELA from the puzzle-piece menu in the toolbar.</li>
            <li>
              Click the MELA icon. In the popup, open <strong>🔑 API keys</strong>,
              paste your Addis AI key (and a Groq or Gemini key for English) and
              press <strong>Save keys</strong>.
            </li>
          </ol>
        </section>
        <section className="content-card">
          <h2>2. Open it once</h2>
          <p>
            Click the MELA icon or press <kbd>Alt + Shift + M</kbd> on any
            website. The popup opens MELA on the page straight away and tells
            you what happened. From then on MELA opens by itself on every page you visit.
            It says “MELA is ready” out loud. Browsers only allow sound after
            you press a key, so the greeting plays on your first key press.
            Screen readers announce it straight away.
          </p>
          <p>
            You can turn this off in the extension settings under{" "}
            <strong>For blind users</strong>.
          </p>
        </section>
        <section className="content-card">
          <h2>3. Talk</h2>
          <p>
            Press <kbd>Ctrl + Shift + M</kbd>, ask your question and stop
            speaking. MELA answers out loud in your language. When you change
            the language, MELA says it out loud in the new language. Your choice
            is remembered on every website.
          </p>
        </section>
      </div>
      <section className="content-card">
        <h2>Shortcuts and voice commands</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Do this</th>
              <th scope="col">What happens</th>
            </tr>
          </thead>
          <tbody>
            {shortcuts.map(([key, action]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="content-card">
        <h2>Who handles each language</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Language</th>
              <th scope="col">Hears you</th>
              <th scope="col">Answers</th>
              <th scope="col">Voice</th>
            </tr>
          </thead>
          <tbody>
            {languages.map(([name, ...cells]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Gemini is the backup for everything. On YouTube, live captions are
          translated by Addis AI into Amharic or Afaan Oromoo.
        </p>
      </section>
      <section className="content-card">
        <h2>Good to know</h2>
        <ul>
          <li>
            Ethiopian voices take about 5–7 seconds to start. The text appears
            immediately.
          </li>
          <li>
            Addis AI voice costs about 5 ETB per spoken minute.
          </li>
          <li>
            Your keys stay in the browser’s extension storage and are never sent
            to the MELA server.
          </li>
        </ul>
      </section>
    </Shell>
  );
}

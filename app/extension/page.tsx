import Shell from "@/components/Shell";
import { Download, KeyRound, Mic, Hand } from "lucide-react";
export const metadata = { title: "MELA Chrome extension" };
export default function ExtensionPage() {
  return (
    <Shell active="Chrome extension" title="Chrome extension">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MELA ON EVERY WEBSITE</div>
          <h1>
            Talk to any page. <em>Hear the answer.</em>
          </h1>
          <p>
            Ask questions about the website you are on by voice or text. MELA
            answers with Gemini, reads the answer aloud and shows it in the
            sign-language box with captions and the visual teacher.
          </p>
          <a
            className="button primary"
            href="/downloads/mela-extension.zip"
            download="mela-extension.zip"
          >
            <Download size={18} aria-hidden="true" /> Download the extension
            (.zip)
          </a>{" "}
          <a className="button" href="/extension/guide">
            Read the quick guide
          </a>
        </div>
      </div>
      <div className="cards-grid">
        <section className="content-card">
          <Download size={28} />
          <h2>1. Install</h2>
          <ol>
            <li>
              Download and unzip <code>mela-extension.zip</code>.
            </li>
            <li>
              Open <code>chrome://extensions</code> in Chrome, Edge or Brave.
            </li>
            <li>
              Turn on <strong>Developer mode</strong> (top right).
            </li>
            <li>
              Click <strong>Load unpacked</strong> and choose the unzipped
              folder.
            </li>
            <li>Pin MELA from the puzzle-piece menu.</li>
          </ol>
        </section>
        <section className="content-card">
          <KeyRound size={28} />
          <h2>2. Connect Gemini</h2>
          <p>
            The settings page opens after install. Paste a free Gemini API key
            from{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              aistudio.google.com/apikey
            </a>
            , click <strong>Save key</strong>, then{" "}
            <strong>Test connection</strong>. The key stays in your browser.
          </p>
        </section>
        <section className="content-card">
          <Mic size={28} />
          <h2>3. Talk</h2>
          <p>
            On any website, click the MELA icon or press <kbd>Alt</kbd>+
            <kbd>Shift</kbd>+<kbd>M</kbd>. Press <strong>Use microphone</strong>{" "}
            and ask, or type and press Enter. Commands like “read page” or
            “scroll down” also work.
          </p>
        </section>
        <section className="content-card">
          <Hand size={28} />
          <h2>Sign-language box</h2>
          <p>
            Every answer plays in the same box as the courses: visual teacher,
            English fingerspelling preview or gestures, with live captions. It
            is an illustrative preview, not a validated EthSL translation.
          </p>
        </section>
      </div>
    </Shell>
  );
}

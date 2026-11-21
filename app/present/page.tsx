import VoiceSample from "./VoiceSample";
export const metadata = { title: "MELA · Live demo" };
const css = `
.p{--ink:#103c4b;--teal:#087e8b;--soft:#eef6f8;min-height:100vh;background:#f5f8f7;color:var(--ink);font:18px/1.55 system-ui,sans-serif}
.p header{background:linear-gradient(135deg,#103c4b,#087e8b);color:#fff;padding:56px 24px 64px;text-align:center}
.p h1{font-size:clamp(2.4rem,6vw,4.2rem);margin:0 0 10px;line-height:1.1}
.p header p{font-size:clamp(1.05rem,2.4vw,1.35rem);max-width:760px;margin:0 auto;opacity:.92}
.p .langs{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.p .langs span{background:#ffffff22;border:1px solid #ffffff55;border-radius:999px;padding:6px 16px;font-weight:700}
.p main{max-width:1100px;margin:-36px auto 0;padding:0 16px 64px}
.p .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px}
.p section{background:#fff;border:1px solid #d6e5ea;border-radius:18px;padding:24px;box-shadow:0 10px 30px #103c4b14}
.p h2{margin:0 0 6px;font-size:1.45rem}
.p .who{font-size:.8rem;font-weight:800;letter-spacing:.08em;color:var(--teal);text-transform:uppercase}
.p ol,.p ul{padding-left:22px;margin:10px 0 0}.p li{margin:6px 0}
.p kbd{background:var(--soft);border:1px solid #b9d3dc;border-bottom-width:3px;border-radius:6px;padding:1px 7px;font:600 .9em ui-monospace,monospace}
.p .say{display:block;background:var(--soft);border-left:4px solid var(--teal);border-radius:8px;padding:8px 12px;margin:8px 0;font-weight:600}
.p .voices{display:grid;gap:10px;margin-top:12px}
.p .voice{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;width:100%;font:inherit;font-weight:700;padding:12px 14px;border:2px solid var(--teal);border-radius:12px;background:#fff;color:var(--ink);cursor:pointer}
.p .voice:hover{background:var(--soft)}.p .voice span{font-weight:400;font-size:.92em;color:#355a70}
.p .voice:focus-visible{outline:3px solid #b46d05;outline-offset:2px}
.p .wide{margin-top:18px}
.p .flow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.p .flow b{background:var(--soft);border:1px solid #c8dde4;border-radius:10px;padding:8px 12px}
.p .flow i{font-style:normal;color:var(--teal);font-weight:800}
.p .honest{background:#fff7e7;border-color:#f0d9a8}
.p footer{text-align:center;color:#4f6b78;padding:0 16px 40px}
`;
export default function Present() {
  return (
    <div className="p">
      <style>{css}</style>
      <header>
        <h1>MELA</h1>
        <p>
          Turns any website into a conversation. It speaks for blind users and
          shows captions and signing for Deaf users, in their own language.
        </p>
        <div className="langs" aria-label="Languages">
          <span>English</span>
          <span lang="am">አማርኛ</span>
          <span lang="om">Afaan Oromoo</span>
          <span lang="ti">ትግርኛ</span>
        </div>
      </header>
      <main>
        <div className="grid">
          <section aria-labelledby="blind">
            <div className="who">For blind & low-vision users</div>
            <h2 id="blind">No screen needed</h2>
            <ol>
              <li>MELA opens by itself on every website and greets you out loud.</li>
              <li>
                Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> and ask:
                <span className="say">“What is this page about?”</span>
              </li>
              <li>
                Switch language by voice:
                <span className="say">“Speak Oromo”</span>
              </li>
            </ol>
          </section>
          <section aria-labelledby="deaf">
            <div className="who">For Deaf & hard-of-hearing users</div>
            <h2 id="deaf">See every answer</h2>
            <ul>
              <li>Live captions timed to the voice</li>
              <li>A visual signing teacher that moves with each answer</li>
              <li>YouTube: live captions translated into Amharic or Afaan Oromoo</li>
            </ul>
          </section>
          <section aria-labelledby="voices">
            <div className="who">Natural Ethiopian voices</div>
            <h2 id="voices">Hear MELA</h2>
            <div className="voices">
              <VoiceSample
                language="om"
                label="Afaan Oromoo"
                text="Akkam, ani MELA dha. Maal si gargaaru?"
              />
              <VoiceSample
                language="am"
                label="Amharic"
                text="ሰላም፣ እኔ መላ ነኝ። ምን ልርዳዎት?"
              />
              <VoiceSample
                language="en"
                label="English"
                text="Hi, I'm MELA. Ask me anything about this page."
              />
            </div>
          </section>
        </div>
        <section className="wide" aria-labelledby="how">
          <div className="who">How it works</div>
          <h2 id="how">One question, about 2 seconds</h2>
          <div className="flow" aria-label="Pipeline">
            <b>🎙 You speak</b>
            <i>→</i>
            <b>Addis AI / Groq hear you</b>
            <i>→</i>
            <b>Answer from this page</b>
            <i>→</i>
            <b>🔊 Natural voice</b>
            <i>+</i>
            <b>🤟 Captions & signing</b>
          </div>
          <p>
            Amharic and Afaan Oromoo use Addis AI. English uses Groq. Gemini is
            the backup. API keys stay in the user&apos;s browser.
          </p>
        </section>
        <section className="wide honest" aria-labelledby="next">
          <div className="who">Honest next step</div>
          <h2 id="next">Real Ethiopian Sign Language</h2>
          <p>
            Today the teacher is a visual aid. Full EthSL translation must be
            built and validated together with Deaf signers. That is our next
            milestone.
          </p>
        </section>
      </main>
      <footer>
        MELA · works in Chrome, Brave and Firefox · press any key once to enable
        sound
      </footer>
    </div>
  );
}

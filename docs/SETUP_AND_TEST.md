# MELA — setup and test guide

Everything you need to run MELA locally, install the Chrome extension and rehearse the
presentation. Work from the `mela-ai` folder.

## 1. Run the website locally

```bash
npm install
npm run dev            # http://localhost:3000
```

`.env.local` (never commit it) needs at least:

```
AI_PROVIDER=gemini
GEMINI_API_KEY=...          # aistudio.google.com/apikey
GEMINI_MODEL=gemini-3.5-flash-lite
GROQ_API_KEY=...            # console.groq.com/keys — fast transcription + backup answers
```

Check it: open <http://localhost:3000/api/v1/health> — `"ai":{"mode":"gemini",...}`.
(`"status":"degraded"` only means no database is connected; chat still works.)

Pages to demo:

| Page | What it shows |
| --- | --- |
| `/savanna/pages/programming-for-beginners.html` | Course page + MELA chat widget |
| `/savanna/pages/concept-with-navigation.html` | Learning page (PWA "Talk" shortcut target) |
| `/extension` | Download page for the Chrome extension |

## 2. Deploy (Vercel)

Add the same variables in Vercel → Settings → Environment Variables, plus
`APP_URL=https://<your-site>` and `TRUST_PROXY=true`, then **redeploy**.
`npm run build` also builds the extension zip served at `/downloads/mela-extension.zip`.

## 3. Install the Chrome extension

1. `npm run extension:build` (or download the zip from `/extension` and unzip it).
2. Open `chrome://extensions` (Chrome, Edge or Brave) → turn on **Developer mode** →
   **Load unpacked** → choose `extension/dist`.
3. The settings page opens. Paste the **Groq** key and/or the **Gemini** key →
   **Save key** → **Test connection** (shows ✓/✗ per provider).
4. After any code change: rebuild, then press the reload ↻ icon on the MELA card.

Optional natural English voice: accept the Orpheus terms once at
<https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english>.

Which AI does what: Groq Whisper transcribes speech (~1 s); English answers come
from Groq; Amharic answers and caption translation from Gemini; each falls back to
the other. Gemini's natural voice is limited to 10 uses/day on a free key, so MELA
speaks with the device voice first. **Microsoft Edge** has the best built-in voices
on Linux; Brave/Flatpak Chrome on Linux may have robotic or no voices (MELA then shows
captions and the sign box).

### MELA's voice (website)

`POST /api/v1/tts` speaks with the best free engine available, in order:
**Groq Orpheus** (natural; accept its terms once in the Groq console) →
**Gemini voice** (natural; ~10/day free) → **eSpeak NG** (free, offline, robotic;
`sudo dnf install espeak-ng` / `sudo apt install espeak-ng`, not available on Vercel) →
the browser's own voice. The `X-Mela-Voice` response header shows which one spoke.
Optional: `GROQ_VOICE=diana` (or hannah, autumn, troy) in `.env.local`.

## 4. Keyboard and voice shortcuts

| Where | Shortcut | Does |
| --- | --- | --- |
| Any website | **Alt+Shift+M** | Open MELA (extension) |
| Website + extension | **Ctrl+Shift+M** (⌘+Shift+M on Mac) | Talk: start the microphone; it stops when you stop talking |
| Website | **Escape** | Stop MELA speaking |
| Installed app (phone/PC) | Long-press the app icon → **Talk to MELA** | Opens and starts listening |
| Website | Volume up ×3 | Talk — only on devices whose browser passes volume keys to web pages (most phones do **not**; use the app shortcut) |

## 5. Blind / screen-reader users (English)

**First visit:** a bar at the very top (the first thing a screen reader reaches) asks
*"Would you like MELA to help you by voice?"* → **Yes, talk to me** · **I use a screen
reader** · **No thanks**. The choice is remembered on the device. If nobody chooses but
the page is used without a mouse/finger (screen-reader style), MELA switches to
screen-reader mode by itself and announces it.

- **Talk mode** — MELA speaks and reads lessons aloud, highlighting what it reads.
- **Screen-reader mode** — MELA never talks over TalkBack/NVDA/VoiceOver: it moves focus
  to the right place and announces through the screen reader.

Press **Ctrl+Shift+M** (or long-press the app icon → Talk) and say, or type in the chat:

| Say | Does |
| --- | --- |
| where am I | Lesson *n* of *m*, its title, sections, where you are |
| help | Lists what you can say |
| list lessons · open lesson 2 · next lesson · previous lesson | Move between lessons (announces the new lesson on arrival) |
| read the lesson | Reads from the start (screen-reader mode: moves focus there) |
| pause · resume · repeat · stop | Control reading |
| next section · previous section | Jump by heading |
| slower · faster | Reading speed |
| quiz me | MELA asks a question; just say your answer and it tells you if you're right |
| explain that simply | Simple explanation of the part being read |
| anything else | Normal AI answer, read aloud in talk mode |

Escape stops MELA speaking. Reset the choice: run
`localStorage.removeItem("mela-voice-mode")` in the browser console and reload.

## 6. Rehearsal checklist (do this on the presentation laptop)

- [ ] `/api/v1/health` shows `"mode":"gemini"`.
- [ ] Website chat: type "What is a variable?" → answer in a few seconds.
- [ ] Website chat: type "ኮምፒውተር ምንድን ነው?" → Amharic answer.
- [ ] Click in the page, press **Ctrl+Shift+M**, ask a question aloud → it is sent by
      itself and answered (and read aloud if the device has a voice).
- [ ] Private window → the "help you by voice?" bar appears → **Yes, talk to me** →
      Ctrl+Shift+M → say "where am I", "read the lesson", "pause", "next lesson", "quiz me".
- [ ] Private window → **I use a screen reader** (with NVDA/TalkBack on if possible) →
      "read the lesson" moves focus and MELA stays silent.
- [ ] Extension settings → **Test connection** shows ✓.
- [ ] Course page → Alt+Shift+M → **Talk** → ask aloud → answer + sign box captions.
- [ ] **Start Jarvis** → "scroll down" → "what is this page about?" → "stop".
- [ ] **📄 Extract data** → Download JSON.
- [ ] YouTube video → open MELA → choose **አማርኛ** → Amharic subtitles appear over
      the video within ~10 s; ask "ይህ ቪዲዮ ስለ ምንድን ነው?".
- [ ] Phone (optional): install the app from Chrome's menu → long-press icon → Talk.

## 7. Automated tests

```bash
npm test                    # 61 unit tests
npm run test:widget         # 28 widget tests
npm run test:integration    # 10 API tests
npm run test:features       # 12 feature tests
npm run test:memory         # 15 site-memory tests
npx tsc --noEmit            # types
```

## 8. Known limits

- Free-tier quotas: Gemini voice 10/day; Gemini/Groq text have daily limits too.
  Use paid keys for a public launch.
- YouTube captions without a caption track trail the speech by ~6–8 s.
- Quick AI answers and translations can contain mistakes; Amharic is AI-drafted.
- The sign box is an illustrative visual aid, not certified EthSL translation.
- Rotate the API keys that were shared in chat after the presentation.

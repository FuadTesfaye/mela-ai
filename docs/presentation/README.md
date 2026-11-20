# As-Sunnah · MELA AI pitch

The organisers explicitly require “Use the shared 6-slide template.” This deck therefore keeps six visible slides, with the extra implementation, demonstration and Q&A detail in speaker notes.

Six-slide pitch for ALX Digital Bridge Accessibility Hackathon, Track 3: Multilingual Assistant and Live Help, 21 November 2026.

- [Submission PDF](As-Sunnah-MELA-AI-Pitch-2026.pdf)
- [Submission PowerPoint](As-Sunnah-MELA-AI-Pitch-2026.pptx)
- [PDF deck](MELA-AI-Project-Overview.pdf)
- [Editable PowerPoint with five-minute speaker notes](MELA-AI-Project-Overview.pptx)
- [All-slide preview](previews/contact-sheet.jpg)

The deck uses As-Sunnah as the team name and MELA AI as the product name. Fuad Tesfaye is Team Lead; Salim Siraj handles Frontend; Sifen Fisaha handles Backend; Yusra Mohhamed handles Animation & Gestures. Roles were supplied by the team.

## Six-slide story and pitch timing

1. **Team and product, 0:00–0:40:** learning opens up; introduce the team and one-sentence product promise.
2. **Problem and audience, 0:40–1:25:** a concrete, illustrative learner journey: an unanswered question without in-context support, and the intended MELA experience. It is not a measured user study.
3. **Solution, 1:25–2:20:** built web Jarvis for voice navigation and tasks, course-aware learning and human help; a much larger course-panel screenshot, occupying most of the slide. The displayed screenshot is more than twice the area of the earlier deck version.
4. **Integration and operation, 2:20–3:10:** three plain-language choices: embed a panel, connect a platform-owned interface by API, or use optional SDK components. Keep the existing layout and approved course sources; show the hosted MVP link. OpenAPI and deployment checks remain in the notes.
5. **Accessibility and Ethiopia, 3:10–4:05:** install supported sites as PWAs, download available courses and use a localised learning agent; keyboard, reading mode, captions and English/Amharic.
6. **Next month and ask, 4:05–5:00:** broader accessibility needs, co-design, more languages including Afaan Oromo and Tigrinya, and expanded offline course access.

Each PowerPoint slide contains its speaking script, practical presenter cues, relevant factual boundaries and optional detail for judges’ questions. The PDF is the visual presentation; speaker notes remain in the editable PowerPoint and generator source.

## Five-minute hosted demo rehearsal

Use [the hosted Savanna capture](https://mela-ai-wheat.vercel.app/savanna/pages/homepage-v1-self-paced.html), not localhost. This is a static Savanna UI capture, not authenticated Savanna production integration.

1. **0:00–0:45:** open the hosted Offline-First & Localized AI lesson. Point out that MELA sits inside the existing page.
2. **0:45–1:45:** ask “What is quantization?” in English, inspect the source, and ask the equivalent in Amharic: “ኳንታይዜሽን ምንድን ነው?” Have a fluent speaker review this wording and the actual response before the pitch. Use the same lesson for both questions.
3. **1:45–2:45:** demonstrate one minute with only the keyboard: reach the assistant, ask a question, follow its source, return, and close/reopen the panel. Rehearse actual focus order beforehand.
4. **2:45–3:45:** show the reading mode or prepared captions/visual explanation. Describe gestures accurately as illustrative; explain pause, replay and learner control.
5. **3:45–4:45:** request a person, inspect the consent/sharing preview, and show a real tutor reply from a separate signed-in tutor session if the deployed backend is verified.
6. **4:45–5:00:** close on the built web Jarvis, multiple platform-integration routes and broader accessibility/language reach. Rehearse the microphone flow and PWA/course-download/local-agent flow separately, then select the strongest short segment that fits the time limit.

Record the verified hosted flow in advance and keep a local copy for an internet outage. A deck PDF or product screenshot is not a screen-recording backup.

## Deployment checks before pitching

The organisers' 19 November findings must be retested after fixes, in this order:

1. `/api/v1/health` returns healthy and a persisted support request receives a tutor reply on the hosted product.
2. An assistant question without page context uses the correct approved Savanna course content by default.
3. A live language model works with consent, or the interface explicitly labels source-extraction fallback. Test the failure path as well.

This presentation task did not change backend configuration or verify the live deployment; outbound DNS was unavailable. Pitch-day checks are recorded in the presenter notes and this guide, without claiming that deployment fixes have passed. Update its operational wording only after obtaining live evidence.

## Product claims and roadmap

The plug-in story is supported by `packages/sdk/README.md`: independent Web Components, Shadow DOM style isolation, optional React adapter and iframe, multiple components, and a `mount()` lifecycle that preserves existing host children. Hosts still configure content, API origins and relevant security policies. This is a **web SDK**, with no native iOS SDK claim.

The team confirmed that **Jarvis for the web is built**. The deck presents microphone-driven navigation, reading, explanations and task assistance as current product capabilities. This update incorporates the team’s confirmation; it does not independently validate cross-site behaviour. The screenshot remains labelled as the course-learning UI, rather than as evidence of web automation.

The deck also incorporates the team’s requested **PWA installation, course downloads and localised learning-agent** story. It says “supported sites” and “available course packs”: installing a PWA does not automatically make arbitrary websites, embedded streaming media or protected resources downloadable. Localised means adapted to the learner’s language and context; it does not by itself assert an on-device neural model. Verify the exact supported offline resources and agent behaviour in the demo. Live human help and fresh online resources need connectivity.

The next-month roadmap now concentrates on **more accessibility needs and more languages**, including co-design for vision, hearing, motor and cognitive access, deeper assistive-technology support, fluent Amharic review, Afaan Oromo, Tigrinya and expanded offline/local-agent access.

The SDK is **optional**. The visible integration slide lists script-tag/Web Component and iframe embeds, direct REST API integration with OpenAPI and webhooks, and the SDK/React adapter. It does not imply every platform already has a dedicated connector.

Prepared Amharic translations await fluent review. Speech depends on browser and device capabilities. Illustrative gestures are not validated EthSL or ASL interpretation. SMS and Telegram are adapters needing configured services. Downloads require an initial connection and supported resources; embedded YouTube streaming and live help are not automatically available offline. Automated accessibility coverage exists in the repository, but fresh test runs, physical-device screen-reader checks and co-designer feedback are not claimed by this deck.

`assets/course-panel.png` shows real product UI with controlled synthetic caption content. The learner example is an illustrative scenario, not a documented interview or a user-study finding.

## Rebuild and review

```sh
python3 build_deck.py
python3 render_deck.py
```

`build_deck.py` uses only Python's standard library to create editable native PowerPoint text, diagrams, image alt text, a demo hyperlink and speaker notes. `assets/deck-base.zip` contains the original deck's Office themes and layouts, without its old slides or slide content.

`render_deck.py` uses system PyGObject/PangoCairo, pycairo and Pillow to export the same source to vector PDF and PNG previews. It reports text that exceeds its allotted height. The PDF has selectable text, embedded fonts and a clickable hosted demo link. It is not a tagged accessible-PDF certification.

Use Montserrat, Noto Sans and Droid Sans Ethiopic for the intended appearance. PowerPoint rendering can vary with local fonts; the PDF preserves the reviewed visual appearance. LibreOffice export was unavailable in the execution environment, so the PowerPoint package was checked structurally and the shared-source PDF was inspected visually.


## Submission copy

The `As-Sunnah-MELA-AI-Pitch-2026` PDF and PowerPoint are named submission copies of the reviewed six-slide files. Regenerate both main files and refresh these copies after any subsequent edit. The final pass enlarges the real product UI, simplifies the integration language, presents the PWA/course/localised-agent journey beside accessibility choices, and closes with a specific learner-pilot ask.

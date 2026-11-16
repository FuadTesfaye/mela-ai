# MELA AI project presentation

Eight slides for a short project introduction or hackathon pitch.

- **MELA-AI-Project-Overview.pptx** — editable slides with speaker notes.
- **MELA-AI-Project-Overview.pdf** — portable presentation copy.
- **build_deck.py** — source generator; text and diagrams remain editable.
- **assets/** — actual product-interface screenshots from controlled browser fixtures.

The deck uses Montserrat for headings and Noto Sans for body text, with a navy/teal palette. Install those fonts for the closest editable-slide rendering; the PDF preserves the exported appearance.

## Story

1. MELA AI: accessible learning, right where you are.
2. The barriers: language, access and missing context.
3. Ask, understand and continue without leaving the lesson.
4. The course panel: captions, illustrations and explanations.
5. Reading mode, text equivalents and learner control.
6. A reusable component with a separate Next.js backend.
7. Local verification: 123 checks, including 34 production browser cases.
8. Next: a learner pilot and real-device validation.

## Evidence and limits

Project facts come from `README.md`, `BUILD_STATUS.md`, `CONFORMANCE.md` and `packages/sdk/README.md`, recorded at commit `4550943` on 16 November 2026. Speaker notes provide supporting detail. The test total comprises 49 unit, 28 widget, 10 API, two PostgreSQL and 34 browser checks. The initial SDK measures 99,980 uncompressed bytes; optional 3D assets load separately.

The screenshots show the implemented UI with controlled fixture text. They are not user-study evidence. The course character uses illustrative gestures, not validated ASL/EthSL translation. Real-device TalkBack/NVDA checks, fluent language/signing review and learner comprehension sessions remain pending. The deck does not claim production deployment or accessibility certification.

## Rebuild

From this directory:

```sh
python3 -m venv /tmp/mela-deck-venv
/tmp/mela-deck-venv/bin/pip install -r requirements.txt
/tmp/mela-deck-venv/bin/python build_deck.py
libreoffice --headless --convert-to pdf --outdir . MELA-AI-Project-Overview.pptx
```

Verification: the PPTX opens and exports through LibreOffice, the PDF contains eight pages, each slide has speaker notes, and the exported slides were visually checked for clipping and layout.

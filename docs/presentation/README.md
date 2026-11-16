# MELA AI project presentation

A short project pitch focused on the learner experience, with editable slides and speaker notes.

- [PowerPoint](MELA-AI-Project-Overview.pptx)
- [PDF](MELA-AI-Project-Overview.pdf)
- `build_deck.py`: editable text and diagram generator.
- `assets/`: product screenshots from controlled browser fixtures.

## Story

1. Accessible learning inside the lesson.
2. Language, access and context barriers.
3. Ask, understand and continue.
4. Captions, illustrations and explanations.
5. Reading mode and learner control.
6. Browser-first component and optional private Gemini relay.
7. English/Amharic reading, captions and voice questions.
8. Try the hosted demo and prepare a learner pilot.

Demo: https://mela-ai-wheat.vercel.app/savanna/pages/homepage-v1-self-paced.html

Prepared translations are AI drafts awaiting fluent review. Original video audio is unchanged. The character uses illustrative gestures, not validated ASL/EthSL interpretation. Physical-device assistive technology and learner comprehension review remain pending. Screenshots are product demonstrations, not user-study evidence.

## Rebuild

```sh
python3 -m venv /tmp/mela-deck-venv
/tmp/mela-deck-venv/bin/pip install -r requirements.txt
/tmp/mela-deck-venv/bin/python build_deck.py
libreoffice --headless --convert-to pdf --outdir . MELA-AI-Project-Overview.pptx
```

Montserrat and Noto Sans are used for editable slides; the PDF preserves the exported appearance.

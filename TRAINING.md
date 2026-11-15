# Offline-First & Localized AI

The user-supplied training by Kidus Yohannes, Senior ML Engineer, is available at:

`/savanna/pages/offline-first-localized-ai.html`

The lesson preserves the supplied 18-part sequence, including the quiz and answers. It is rendered in the imported Savanna shell, linked from the homepages/sidebar, and indexed as English source material with a citation for each slide. Sections cover connectivity/privacy/cost/speed, hybrid architectures, small models, quantization, deployment choices, interchangeable interfaces, localization, RAG/LoRA, native-speaker testing and practical project ideas.

Source: supplied text in this conversation. Slide boundaries and paragraph formatting were reconstructed from those notes; no recording, slide artwork or reviewed sign-language track was supplied. The optional YouTube example is not represented as this session's recording.

- Edit `data/training/offline-first-localized-ai.json` to update the rendered lesson.
- Update its corresponding sections in `data/content.json` for the downloadable/offline catalogue.
- `scripts/build-training.mjs` generates the Savanna lesson during widget builds.
- After changing indexed materials on an existing database, re-index through the tutor content API; seeds intentionally preserve existing rows.
- Visit the lesson online and let offline caching finish before testing offline reload. Its text and source search work without a cloud model. No local generative model weights are bundled.

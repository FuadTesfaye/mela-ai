# Prepared demo captions

The selected public demo is **Building with Gemini 2.0: Multimodal live streaming**, published by Google for Developers:
https://www.youtube.com/watch?v=9hE5-98ZeCg

`9hE5-98ZeCg.json` contains its prepared English source-caption track. `9hE5-98ZeCg.am.json` contains an AI-authored Amharic translation draft matched to that exact source revision. Original cue timing is retained by the player; translations do not drive the animation clock. Fluent review remains pending.

These two public demo assets ship with the frontend so the Vercel deployment can show captions without a Python preparation step or a live AI call. Other generated transcripts stay ignored by Git. The original video and captions belong to their respective rights holders; this is an accessibility-focused project demo, not a claim of ownership.

Refresh source captions using `scripts/prepare-video.py` with the optional video dependency. Run `npm run prepare:translations` to retain a matching prepared pack or generate a replacement through the server-side Gemini key. Do not commit API keys, private recordings, conversations or arbitrary learners' transcripts here.

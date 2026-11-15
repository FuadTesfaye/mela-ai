Prepared course captions are a local cache, not source code. Run the optional
`scripts/prepare-video.py` preparation step documented in the root README to
retrieve the selected video's existing English captions. Generated JSON is
excluded from Git. The app loads this cache automatically and can instead use
consented Gemini transcription if no prepared captions are available.

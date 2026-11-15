"""Prepare a local caption cache from the selected video's existing English track.
No Gemini key is required. Caption text stays out of Git; rerun on deployment.
Install the optional preparation dependency with scripts/requirements-video.txt.
"""
import json
import re
from pathlib import Path
from datetime import datetime, timezone
from youtube_transcript_api import YouTubeTranscriptApi

root = Path(__file__).resolve().parents[1]
video = json.loads((root / "data/lesson-media.json").read_text())
result = YouTubeTranscriptApi().fetch(video["videoId"], languages=["en"])
raw = sorted(result.to_raw_data(), key=lambda cue: cue["start"])
cues = []
for index, cue in enumerate(raw):
    start = round(cue["start"], 3)
    end = cue["start"] + cue["duration"]
    if index + 1 < len(raw):
        end = min(end, raw[index + 1]["start"])
    end = round(end, 3)
    text = re.sub(r"\s+", " ", cue["text"]).strip()
    if text and end > start:
        cues.append({"start": start, "end": end, "text": text})
if not cues or len(cues) > 240 or sum(len(c["text"]) for c in cues) > 60000:
    raise ValueError("The selected caption track is empty or exceeds the supported limits")
value = {"title": video["title"], "language": "en", "videoUrl": video["videoUrl"],
         "generated": result.is_generated, "source": "youtube-captions",
         "retrievedAt": datetime.now(timezone.utc).isoformat(), "cues": cues}
output = root / "public/transcripts" / (video["videoId"] + ".json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
print(f"Prepared {len(cues)} English source captions: {output.relative_to(root)}")

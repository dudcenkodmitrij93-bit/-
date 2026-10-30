---
name: whisper
description: Transcribe speech in videos/audio with Whisper (local faster-whisper) to text, SRT/VTT subtitles or word-level timestamps for animated captions in Reels and TikTok. Supports Russian and auto language detection. Use for subtitles, captions, transcripts or finding cut points by speech.
---

# Whisper transcription

## Setup (cloud containers are ephemeral — reinstall each session if missing)
```bash
python3 -c "import faster_whisper" 2>/dev/null || pip install -q faster-whisper
```
Model is downloaded on first use from huggingface.co (the cloud environment's network policy must allow `huggingface.co` and `*.hf.co`; a `403 Forbidden` / ProxyError means it is blocked - tell the user to add it under the environment's Network access → Allowed domains). Sizes: `small` (fast, OK), `medium` (good for Russian), `large-v3` (best, slow on CPU). On CPU use `compute_type="int8"`.

## Run
Use the bundled script:
```bash
python3 .claude/skills/whisper/transcribe.py input.mp4 --model medium --lang ru --out out/name
```
Outputs: `name.txt`, `name.srt` (phrase-level), `name.words.json` (word timestamps), `name.ass` (bold centered captions, 2–4 words per line, Reels-style, safe-zone margin).
`--lang` omitted → auto-detect. `--max-words 3` controls caption chunk size.

Video input works directly (faster-whisper uses ffmpeg/PyAV); for long files you may first extract audio: `ffmpeg -i in.mp4 -vn -ac 1 -ar 16000 audio.wav`.

## After transcription
- Burn captions: `ffmpeg -i in.mp4 -vf "ass=out/name.ass" -c:a copy captioned.mp4` (see ffmpeg skill for export preset)
- Animated captions in Remotion: feed `name.words.json` into the remotion-captions skill (`@remotion/captions` format: text, startMs, endMs)
- HyperFrames captions: see hyperframes / media-use skills (transcripts)
- Always proofread the text: fix names, brand terms and punctuation before burning in. Ask the user about unclear words.

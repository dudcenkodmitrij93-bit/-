---
name: ffmpeg
description: Edit, cut, convert and finish vertical videos (Instagram Reels, TikTok, Shorts) with FFmpeg - crop/scale to 9:16 1080x1920, trim, concatenate, speed, burn subtitles, overlays, music mixing, loudness, thumbnails and export presets. Use for any video or audio processing on the command line.
---

# FFmpeg for Reels / TikTok

Check first: `ffmpeg -version`. If missing: `apt-get install -y ffmpeg`.
Always inspect input before editing:
```bash
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,duration -of compact "in.mp4"
```

## Target spec (Reels + TikTok)
- 1080x1920 (9:16), 30 fps (or source 25/30/60), H.264 High, yuv420p, AAC 48 kHz 192k, `+faststart`
- Length: Reels up to 90 s optimal, TikTok 15–60 s; hook in the first 1–2 s
- Safe zone: keep text out of the top ~250 px and bottom ~420 px, and ~120 px right edge (UI buttons)
- Loudness: -14 LUFS integrated, true peak -1 dB

## Export preset (use as final step)
```bash
ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart out.mp4
```

## Recipes
**Horizontal → 9:16, center crop:**
`-vf "scale=-2:1920,crop=1080:1920"`

**Horizontal → 9:16 with blurred background (no crop):**
```bash
-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
```

**Trim (accurate):** `ffmpeg -ss 00:00:05 -to 00:00:20 -i in.mp4 ...` (re-encode). Fast, keyframe-cut: add `-c copy`.

**Concatenate clips (same codec/size):** write `list.txt` with `file 'a.mp4'` lines, then
`ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4`. Different sizes → normalize each with the export preset + scale/crop first.

**Crossfade between two clips:** `-filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=<len0-0.5>[v];[0:a][1:a]acrossfade=d=0.5[a]" -map "[v]" -map "[a]"`

**Speed:** 2x → `-filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]"`. Slow-mo 0.5x → `setpts=2*PTS`, `atempo=0.5`.

**Photo slideshow (images → video, 3 s each, Ken Burns zoom):**
```bash
ffmpeg -loop 1 -t 3 -i photo.jpg -vf "scale=2160:-2,zoompan=z='min(zoom+0.0015,1.2)':d=90:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30" -pix_fmt yuv420p clip.mp4
```
(`.webp` inputs work the same.)

**Burn subtitles (from Whisper .srt/.ass):**
`-vf "subtitles=subs.srt:force_style='FontName=Montserrat,FontSize=14,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=3,Alignment=2,MarginV=180'"`
For word-by-word animated captions prefer `.ass` (see whisper skill) or Remotion/HyperFrames captions.

**Text overlay:** `drawtext=text='ТЕКСТ':fontfile=/path/font.ttf:fontsize=72:fontcolor=white:borderw=4:bordercolor=black:x=(w-tw)/2:y=300:enable='between(t,0,3)'`
Cyrillic needs a font that has it (e.g. DejaVuSans, Montserrat, Inter). Find: `fc-list :lang=ru`.

**Logo/watermark:** `-i logo.png -filter_complex "[1:v]scale=200:-1[l];[0:v][l]overlay=W-w-60:H-h-500"`

**Background music under voice (ducked):**
```bash
-filter_complex "[1:a]volume=0.15[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]" -map 0:v -map "[a]"
```
Sidechain ducking: `[m][0:a]sidechaincompress=threshold=0.05:ratio=8[duck];[0:a][duck]amix=inputs=2`.

**Replace audio with a track:** `-i video.mp4 -i music.mp3 -map 0:v -map 1:a -shortest -c:v copy`

**Loudness normalize:** `-af loudnorm=I=-14:TP=-1:LRA=11`

**Extract audio for Whisper:** `ffmpeg -i in.mp4 -vn -ac 1 -ar 16000 audio.wav`

**Cover/thumbnail frame:** `ffmpeg -ss 2 -i in.mp4 -frames:v 1 -q:v 2 cover.jpg`

**Contact sheet to review a video visually:** `ffmpeg -i in.mp4 -vf "fps=1,scale=270:-1,tile=6x4" -frames:v 1 sheet.jpg` then read the image.

**Remove silence (talking head jump-cuts):** `-af silenceremove=stop_periods=-1:stop_duration=0.4:stop_threshold=-35dB` (audio only; for synced video cuts, detect with `silencedetect` and cut segments).

## Workflow
1. ffprobe inputs. 2. Build each step into an intermediate file in a work folder (not the repo root). 3. Final pass with the export preset. 4. Verify: ffprobe the output + contact sheet, check duration, 1080x1920, audio present.
Keep large renders out of git unless the user asks to commit them.

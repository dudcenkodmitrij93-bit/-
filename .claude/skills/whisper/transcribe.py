#!/usr/bin/env python3
"""Transcribe audio/video with faster-whisper -> txt, srt, words.json, ass (Reels-style captions)."""
import argparse
import json
import os

from faster_whisper import WhisperModel


def ts_srt(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def ts_ass(t):
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02}:{s:02}.{cs:02}"


ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},86,&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,90,90,520,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("input")
    p.add_argument("--model", default="medium")
    p.add_argument("--lang", default=None, help="e.g. ru, en; omit to auto-detect")
    p.add_argument("--out", default=None, help="output path prefix (no extension)")
    p.add_argument("--max-words", type=int, default=3)
    p.add_argument("--font", default="Montserrat")
    p.add_argument("--device", default="auto")
    a = p.parse_args()

    out = a.out or os.path.splitext(a.input)[0]
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    compute = "int8" if a.device in ("auto", "cpu") else "float16"
    model = WhisperModel(a.model, device=a.device, compute_type=compute)
    segments, info = model.transcribe(a.input, language=a.lang, word_timestamps=True, vad_filter=True)
    print(f"language={info.language} p={info.language_probability:.2f} duration={info.duration:.1f}s")

    segs, words = [], []
    for s in segments:
        segs.append((s.start, s.end, s.text.strip()))
        for w in s.words or []:
            words.append({"text": w.word.strip(), "startMs": int(w.start * 1000), "endMs": int(w.end * 1000),
                          "confidence": round(w.probability, 3)})

    with open(out + ".txt", "w", encoding="utf-8") as f:
        f.write("\n".join(t for _, _, t in segs) + "\n")
    with open(out + ".srt", "w", encoding="utf-8") as f:
        for i, (st, en, t) in enumerate(segs, 1):
            f.write(f"{i}\n{ts_srt(st)} --> {ts_srt(en)}\n{t}\n\n")
    with open(out + ".words.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)
    with open(out + ".ass", "w", encoding="utf-8") as f:
        f.write(ASS_HEADER.format(font=a.font))
        for i in range(0, len(words), a.max_words):
            chunk = words[i:i + a.max_words]
            st, en = chunk[0]["startMs"] / 1000, chunk[-1]["endMs"] / 1000
            text = " ".join(w["text"] for w in chunk).upper()
            f.write(f"Dialogue: 0,{ts_ass(st)},{ts_ass(en)},Default,,0,0,0,,{text}\n")
    print("wrote", ", ".join(out + e for e in (".txt", ".srt", ".words.json", ".ass")))


if __name__ == "__main__":
    main()

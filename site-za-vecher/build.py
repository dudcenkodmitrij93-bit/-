#!/usr/bin/env python3
"""Generates index.html: 'Сайт за вечер' vertical TikTok (1080x1920), timed to assets/voice.wav.

Edit scene text/timings here and re-run: python3 build.py
"""
import json
import random
import subprocess

DUR = 61.46
W = json.load(open("assets/transcript.json", encoding="utf-8"))

DARK, PAPER, RED, TEAL, INK = "#0b0d10", "#ece8e1", "#ff3b1f", "#2be0a8", "#111111"

# scene id, start, end, theme
SCENES = [
    ("s01", 0.00, 5.80, "dark"),
    ("s02", 5.80, 10.50, "light"),
    ("s03", 10.50, 15.70, "dark"),
    ("s04", 15.70, 17.00, "red"),
    ("s05", 17.00, 22.20, "dark"),
    ("s06", 22.20, 27.50, "light"),
    ("s07", 27.50, 33.10, "dark"),
    ("s08", 33.10, 35.40, "light"),
    ("s09", 35.40, 37.80, "dark"),
    ("s10", 37.80, 41.15, "light"),
    ("s11", 41.15, 44.95, "dark"),
    ("s12", 44.95, 50.50, "light"),
    ("s13", 50.50, 55.85, "dark"),
    ("s14", 55.85, DUR, "red"),
]
BG = {"dark": DARK, "light": PAPER, "red": RED}
FG = {"dark": "#f4f1ec", "light": INK, "red": "#fff"}

html, js, audio = [], [], []


def T(s):
    return f"{s:.3f}"


def tw(sel, frm, to, at):
    js.append(f'tl.fromTo("{sel}", {json.dumps(frm)}, {json.dumps(to)}, {T(at)});')


def pop(sel, at, d=0.35, y=40):
    tw(sel, {"opacity": 0, "y": y, "scale": 0.92}, {"opacity": 1, "y": 0, "scale": 1, "duration": d, "ease": "back.out(2)"}, at)


def slam(sel, at, d=0.3):
    tw(sel, {"opacity": 0, "scale": 1.6, "filter": "blur(12px)"}, {"opacity": 1, "scale": 1, "filter": "blur(0px)", "duration": d, "ease": "expo.out"}, at)


def wipe(sel, at, d=0.35):
    tw(sel, {"clipPath": "inset(0 100% 0 0)"}, {"clipPath": "inset(0 0% 0 0)", "duration": d, "ease": "power3.out"}, at)


def typed(sel, at, d):
    tw(sel, {"clipPath": "inset(0 100% 0 0)"}, {"clipPath": "inset(0 0% 0 0)", "duration": d, "ease": "steps(24)"}, at)


SFX_N = [0]


def sfx(name, at, vol=0.8):
    SFX_N[0] += 1
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"assets/sfx/{name}.mp3"], capture_output=True, text=True).stdout)
    d = min(d, 0.6 if name.startswith("impact") else 1.5, DUR - at)  # short hits only: long tails read as noise under the voice
    vol = min(vol, 0.55) if name.startswith("impact") else vol
    audio.append(f'<audio id="fx{SFX_N[0]:02d}" class="clip" src="assets/sfx/{name}.mp3" data-start="{T(at)}" data-duration="{d:.3f}" data-fade-out="0.3" data-track-index="{3 + SFX_N[0]}" data-volume="{vol}"></audio>')


def scene(sid, inner):
    s, e, th = next((a, b, c) for i, a, b, c in SCENES if i == sid)
    html.append(f'<section id="{sid}" class="clip scene {th}" data-start="{T(s)}" data-duration="{T(e - s)}" data-track-index="1" data-track-kind="graphics"><div class="in" id="{sid}-in">{inner}</div></section>')
    # every scene enters with a quick push + punch
    tw(f"#{sid}-in", {"y": 90, "scale": 1.04, "opacity": 0.0}, {"y": 0, "scale": 1, "opacity": 1, "duration": 0.32, "ease": "expo.out"}, s if s > 0 else 0)
    # slow drift so nothing is ever static
    js.append(f'tl.to("#{sid}-in", {{scale: 1.025, duration: {max(0.4, e - s - 0.35):.3f}, ease: "none"}}, {T(s + 0.33)});')


def step(time, n):
    return f'<div class="step mono">{time} · ШАГ {n}</div>'


# ---------- S01 hook: frame 0 already has the line ----------
scene("s01", f'''
<div class="kicker mono" id="s01-k">// 2015 · как это было</div>
<h1 class="t1" id="s01-a">РАНЬШЕ<br>НА ОДИН САЙТ<br>НУЖНА БЫЛА</h1>
<div class="huge teal glitch" id="s01-b">КОМАНДА</div>
<div class="row mono dim" id="s01-c"><span>4 человека</span><span>·</span><span>месяц работы</span></div>''')
tw("#s01-a", {"opacity": 1}, {"opacity": 1, "duration": 0.01}, 0)
pop("#s01-k", 0.2)
slam("#s01-b", 5.00)
tw("#s01-b", {"x": -18}, {"x": 0, "duration": 0.3, "ease": "elastic.out(1.2, 0.2)"}, 5.05)
pop("#s01-c", 5.30)
sfx("impact-bass-1", 5.01, 0.9)

# ---------- S02 the team ----------
roles = [("ДИЗАЙНЕР", "макеты в Figma", 5.84), ("ВЕРСТАЛЬЩИК", "HTML и CSS", 6.52), ("КОПИРАЙТЕР", "тексты", 7.28), ("ПРОГРАММИСТ", "формы и бэкенд", 8.18)]
cards = "".join(f'<div class="card" id="s02-c{i}"><div class="ava ava{i}"></div><b>{r}</b><small class="mono">{d}</small></div>' for i, (r, d, _) in enumerate(roles))
weeks = "".join(f'<div class="wk"><i id="s02-w{i}"></i><small class="mono">неделя {i + 1}</small></div>' for i in range(4))
scene("s02", f'''
<h1 class="t2" id="s02-t">4 ЧЕЛОВЕКА<br><span class="hl red">И МЕСЯЦ</span></h1>
<div class="grid2">{cards}</div>
<div class="weeks">{weeks}</div>''')
pop("#s02-t", 5.85)
for i, (_, _, t) in enumerate(roles):
    pop(f"#s02-c{i}", t - 0.04)
    sfx("pop", t, 0.6)
for i in range(4):
    tw(f"#s02-w{i}", {"scaleX": 0}, {"scaleX": 1, "duration": 0.22, "ease": "power2.out"}, 9.14 + i * 0.2)
sfx("whoosh-short", 9.12, 0.5)

# ---------- S03 now: me + AI ----------
scene("s03", f'''
<div class="kicker mono teal" id="s03-k">// сейчас</div>
<div class="huge" id="s03-a" data-layout-ignore>СЕЙЧАС</div>
<div class="eq">
  <div class="eqrow" id="s03-b"><span class="big">1 ЧЕЛОВЕК</span></div>
  <div class="eqrow" id="s03-c"><span class="big teal">+ ИИ</span></div>
  <div class="eqrow" id="s03-d"><span class="big hl red">= 1 ВЕЧЕР</span></div>
</div>''')
slam("#s03-a", 10.62)
pop("#s03-k", 10.7)
tw("#s03-a", {"opacity": 1}, {"opacity": 0.12, "duration": 0.3}, 11.4)
pop("#s03-b", 11.46)
pop("#s03-c", 12.58)
slam("#s03-d", 14.24)
sfx("whoosh", 10.52, 0.55)
sfx("pop", 11.47, 0.5)
sfx("sparkle", 12.6, 0.6)
sfx("impact-bass-2", 14.25, 0.85)

# ---------- S04 'вот, посмотри' ----------
scene("s04", '''<div class="huge white" id="s04-a">ВОТ,</div><div class="huge white" id="s04-b">ПОСМОТРИ</div><div class="clock mono" id="s04-c">19:00</div>''')
slam("#s04-a", 15.74)
slam("#s04-b", 15.96)
pop("#s04-c", 16.4)
sfx("whoosh-cinematic", 15.70, 0.6)

# ---------- S05 19:00 meaning & texts ----------
lines = [("01", "Оффер: завтрак за 15 минут"), ("02", "Меню с ценами и фото"), ("03", "Отзывы гостей"), ("04", "Форма брони столика")]
ls = "".join(f'<div class="li mono" id="s05-l{i}"><span class="teal">{n}</span> {t}</div>' for i, (n, t) in enumerate(lines))
scene("s05", f'''
{step("19:00", 1)}
<h1 class="t2" id="s05-t">СМЫСЛ<br><span class="hl teal ink">И ТЕКСТЫ</span></h1>
<div class="win dark-win">
  <div class="bar"><i></i><i></i><i></i><span class="mono">чат с ИИ</span></div>
  <div class="msg mono" id="s05-m">Кофейня в центре. Хотим, чтобы на завтраки приходило больше людей.</div>
  <div class="ans">{ls}</div>
</div>''')
pop("#s05-t", 17.04)
typed("#s05-m", 17.72, 1.9)
sfx("typing", 17.72, 0.45)
for i in range(4):
    pop(f"#s05-l{i}", 20.12 + i * 0.36, 0.28, 20)
    sfx("key-press", 20.12 + i * 0.36, 0.45)
sfx("whoosh", 17.0, 0.5)

# ---------- S06 20:00 design ----------
scene("s06", f'''
{step("20:00", 2)}
<h1 class="t2" id="s06-t"><span class="hl red">ДИЗАЙН</span></h1>
<div class="win light-win">
  <div class="bar"><i></i><i></i><i></i><span class="mono">coffee-zavtrak.ru</span></div>
  <div class="wf">
    <div class="nav" id="s06-b0"></div>
    <div class="hero" id="s06-b1"><b id="s06-h">ЗАВТРАК<br>ЗА 15 МИНУТ</b></div>
    <div class="side" id="s06-b2"></div>
    <div class="tri"><div id="s06-b3"></div><div id="s06-b4"></div><div id="s06-b5"></div></div>
    <div class="foot" id="s06-b6"></div>
  </div>
</div>
<div class="note mono" id="s06-n">блоки собираются в страницу — я правлю под вкус</div>''')
slam("#s06-t", 23.14)
for i in range(7):
    tw(f"#s06-b{i}", {"opacity": 0, "y": -120, "rotation": -4 + i}, {"opacity": 1, "y": 0, "rotation": 0, "duration": 0.32, "ease": "back.out(1.6)"}, 23.80 + i * 0.16)
sfx("click-soft", 23.82, 0.5)
sfx("click-soft", 24.30, 0.5)
sfx("click-soft", 24.78, 0.5)
tw("#s06-b1", {"backgroundColor": "#dcdcdc"}, {"backgroundColor": RED, "duration": 0.3}, 25.80)
pop("#s06-h", 25.95)
pop("#s06-n", 26.2)
sfx("pop", 25.82, 0.6)
sfx("whoosh-short", 22.2, 0.5)

# ---------- S07 21:00 code ----------
code = [
    '<span class="c">// hero кофейни</span>',
    'const hero = section({',
    '  title: <span class="s">"Завтрак за 15 минут"</span>,',
    '  button: <span class="s">"Забронировать"</span>,',
    '  animate: <span class="s">"fade-up"</span>',
    '});',
    'form.<span class="f">onSubmit</span>(sendToTelegram);',
]
cl = "".join(f'<div class="cl" id="s07-l{i}">{c}</div>' for i, c in enumerate(code))
scene("s07", f'''
{step("21:00", 3)}
<h1 class="t2" id="s07-t">ВСЁ — <span class="hl teal ink">КОД</span></h1>
<div class="win dark-win code mono">{cl}</div>
<div class="btnrow"><div class="cta" id="s07-b">ЗАБРОНИРОВАТЬ</div><div class="tag mono" id="s07-g">+ вместе с ИИ</div></div>''')
slam("#s07-t", 28.36)
for i in range(len(code)):
    typed(f"#s07-l{i}", 28.6 + i * 0.4, 0.34)
sfx("typing", 28.6, 0.4)
pop("#s07-b", 29.12)
tw("#s07-b", {"scale": 1}, {"scale": 1.08, "duration": 0.15, "yoyo": True, "repeat": 3, "ease": "sine.inOut"}, 29.8)
sfx("click", 29.14, 0.7)
pop("#s07-g", 31.9)
sfx("sparkle", 31.9, 0.5)
sfx("whoosh", 27.5, 0.5)

# ---------- S08 22:00 adaptive ----------
scene("s08", f'''
{step("22:00", 4)}
<h1 class="t2" id="s08-t"><span class="hl red">АДАПТИВ</span></h1>
<div class="dev" id="s08-d"><div class="scr"><div class="hero2">ЗАВТРАК<br>ЗА 15 МИНУТ</div><div class="g1"></div><div class="g2"></div><div class="g3"></div></div></div>
<div class="note mono" id="s08-n">под любой телефон</div>''')
slam("#s08-t", 34.04)
tw("#s08-d", {"width": 900, "height": 600, "borderRadius": 18}, {"width": 400, "height": 760, "borderRadius": 56, "duration": 0.55, "ease": "expo.inOut"}, 34.45)
pop("#s08-n", 34.9)
sfx("whoosh-short", 34.45, 0.6)
sfx("whoosh-short", 33.1, 0.45)

# ---------- S09 23:00 launch ----------
scene("s09", f'''
{step("23:00", 5)}
<h1 class="t2" id="s09-t"><span class="hl teal ink">ЗАПУСК</span></h1>
<div class="url mono"><span id="s09-u">https://coffee-zavtrak.ru</span></div>
<div class="prog"><i id="s09-p"></i></div>
<div class="ok" id="s09-o">✓ ОПУБЛИКОВАНО</div>''')
slam("#s09-t", 35.46)
typed("#s09-u", 35.6, 0.6)
tw("#s09-p", {"scaleX": 0}, {"scaleX": 1, "duration": 1.1, "ease": "power2.inOut"}, 35.8)
slam("#s09-o", 36.94)
sfx("riser", 35.75, 0.35)
sfx("notification", 36.96, 0.8)

# ---------- S10 was / now ----------
scene("s10", '''
<div class="vs">
  <div class="was" id="s10-a"><small class="mono">БЫЛО</small><b>4 ЧЕЛОВЕКА</b><b>1 МЕСЯЦ</b><i class="strike" id="s10-s"></i></div>
  <div class="now" id="s10-b"><small class="mono teal">СТАЛО</small><b>Я + ИИ</b><b class="red">1 ВЕЧЕР</b></div>
</div>''')
pop("#s10-a", 37.86)
tw("#s10-s", {"scaleX": 0}, {"scaleX": 1, "duration": 0.3, "ease": "power3.out"}, 39.80)
slam("#s10-b", 39.96)
sfx("whoosh-short", 37.8, 0.5)
sfx("impact-bass-1", 39.97, 0.8)

# ---------- S11 nuance ----------
scene("s11", '''
<h1 class="t1" id="s11-a">НО ЕСТЬ<br><span class="hl red">НЮАНС</span></h1>
<div class="huge2" id="s11-b">ИИ НЕ ЗНАЕТ<br><span class="red">ТВОЕГО<br>КЛИЕНТА</span></div>''')
pop("#s11-a", 41.24)
tw("#s11-a .hl", {"scale": 0.6, "opacity": 0}, {"scale": 1, "opacity": 1, "duration": 0.3, "ease": "back.out(3)"}, 42.4)
slam("#s11-b", 43.02)
sfx("impact-bass-2", 42.42, 0.7)

# ---------- S12 sells meaning ----------
scene("s12", '''
<h1 class="t1" id="s12-a" style="font-size:112px">ПРОДАЁТ НЕ КОД,</h1>
<div class="huge red" id="s12-b">А СМЫСЛ</div>
<div class="pills">
  <div class="pill" id="s12-p0"><span class="mono">01</span>СТРУКТУРА</div>
  <div class="pill hot" id="s12-p1"><span class="mono">02</span>ОФФЕР</div>
  <div class="pill" id="s12-p2"><span class="mono">03</span>ДОВЕРИЕ</div>
</div>''')
pop("#s12-a", 45.02)
slam("#s12-b", 45.86)
for i, t in enumerate([47.12, 47.84, 48.18]):
    tw(f"#s12-p{i}", {"opacity": 0, "x": -160}, {"opacity": 1, "x": 0, "duration": 0.28, "ease": "expo.out"}, t)
    sfx("pop", t, 0.55)
sfx("impact-bass-1", 45.88, 0.75)

# ---------- S13 this video is a site ----------
rnd = random.Random(7)
glyphs = "01{}/;=()abcdefgконстсайт"
cols = ""
for c in range(14):
    txt = "<br>".join("".join(rnd.choice(glyphs) for _ in range(rnd.randint(2, 5))) for _ in range(26))
    cols += f'<div class="rc mono" data-layout-ignore id="s13-r{c}" style="left:{c * 78}px">{txt}</div>'
scene("s13", f'''
<div class="rain" data-layout-ignore>{cols}</div>
<h1 class="t1" id="s13-a">КСТАТИ,<br>ЭТОТ РОЛИК —</h1>
<div class="huge teal" id="s13-b">ТОЖЕ САЙТ</div>
<div class="zero" id="s13-zw"><b id="s13-z">0</b><span class="mono">кадров в монтаже</span></div>
<div class="tag2 mono" id="s13-c">&lt;только код /&gt;</div>''')
pop("#s13-a", 50.62)
slam("#s13-b", 51.58)
pop("#s13-zw", 52.4)
for c in range(14):
    tw(f"#s13-r{c}", {"y": -900 - (c * 137) % 400}, {"y": 200, "duration": 5.3, "ease": "none"}, 50.55)
tw(".rain", {"opacity": 0}, {"opacity": 0.22, "duration": 0.6}, 52.4)
pop("#s13-c", 54.50)
sfx("riser", 50.9, 0.4)
sfx("impact-bass-2", 51.6, 0.85)
sfx("typing", 54.50, 0.35)

# ---------- S14 CTA ----------
scene("s14", '''
<div class="kicker mono white" id="s14-k">как я собираю такие сайты</div>
<h1 class="t1 white" id="s14-a">ПОШАГОВО —<br>В ТЕЛЕГРАМЕ</h1>
<div class="tg" id="s14-t"><span class="plane">➤</span><span class="mono">t.me/dudchenko_dmitry</span></div>
<div class="small-cap mono white" id="s14-l">ссылка в профиле</div>
<div class="huge white" id="s14-s">ПОДПИСЫВАЙСЯ</div>''')
pop("#s14-k", 55.94)
pop("#s14-a", 57.5)
pop("#s14-t", 58.3)
pop("#s14-l", 59.06)
slam("#s14-s", 59.94)
tw("#s14-s", {"scale": 1}, {"scale": 1.06, "duration": 0.3, "yoyo": True, "repeat": 1, "ease": "sine.inOut"}, 60.4)
sfx("whoosh-cinematic", 55.85, 0.55)
sfx("ping", 58.32, 0.6)
sfx("impact-bass-1", 59.96, 0.9)

# ---------- captions: 2-4 words, break on punctuation/pauses ----------
groups, cur = [], []
for i, w in enumerate(W):
    cur.append(w)
    nxt = W[i + 1] if i + 1 < len(W) else None
    brk = (w["text"][-1] in ",.—" or len(cur) >= 3 or nxt is None or nxt["start"] - w["end"] > 0.15)
    if brk:
        groups.append(cur)
        cur = []
caps = []
for gi, g in enumerate(groups):
    s = max(0.1, g[0]["start"] - 0.05)
    nxt = groups[gi + 1][0]["start"] - 0.05 if gi + 1 < len(groups) else DUR
    e = min(nxt, g[-1]["end"] + 0.6)
    th = next(c for _, a, b, c in SCENES if a <= s < b)
    words = "".join(f'<span class="w" id="cw{gi}_{k}">{x["text"].strip(",.").upper()}</span> ' for k, x in enumerate(g))
    caps.append(f'<div class="clip cap {th}" id="cg{gi}" data-start="{T(s)}" data-duration="{T(e - s)}" data-track-index="2"><span class="chip">{words.strip()}</span></div>')
    tw(f"#cg{gi}", {"opacity": 0, "y": 18, "scale": 0.94}, {"opacity": 1, "y": 0, "scale": 1, "duration": 0.14, "ease": "back.out(2.5)"}, s)
    for k, x in enumerate(g):
        tw(f"#cw{gi}_{k}", {"opacity": 0.35}, {"opacity": 1, "duration": 0.06}, max(s, x["start"] - 0.02))
    js.append(f'tl.to("#cg{gi}", {{opacity: 0, duration: 0.1, ease: "power2.in"}}, {T(e - 0.1)});')

# ---------- chrome: header + frame counter + progress ----------
counters = "".join(f'<span class="clip fc" id="fc{i}" data-start="{T(a)}" data-duration="{T(b - a)}" data-track-index="3">КАДР {i + 1:02d} / {len(SCENES)}</span>' for i, (_, a, b, _) in enumerate(SCENES))
tw("#pbar", {"scaleX": 0}, {"scaleX": 1, "duration": DUR, "ease": "none"}, 0)

page = f'''<!doctype html>
<html lang="ru" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="assets/gsap.min.js"></script>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1920px;overflow:hidden;background:{DARK}}}
body{{font-family:"Oswald",sans-serif;-webkit-font-smoothing:antialiased}}
.mono{{font-family:"JetBrains Mono",monospace;font-weight:400;letter-spacing:.02em}}
.scene{{position:absolute;inset:0;overflow:hidden}}
.scene.dark{{background:radial-gradient(120% 80% at 50% 35%,#171b21 0%,{DARK} 70%)}}
.scene.light{{background:radial-gradient(120% 80% at 50% 35%,#f6f3ee 0%,{PAPER} 75%)}}
.scene.red{{background:radial-gradient(110% 80% at 50% 40%,#ff4a2b 0%,#d92c12 100%)}}
.in{{position:absolute;left:70px;right:70px;top:250px;height:910px;display:flex;flex-direction:column;justify-content:center;gap:30px}}
.dark .in{{color:{FG["dark"]}}} .light .in{{color:{FG["light"]}}} .red .in{{color:#fff}}
.t1{{font-size:132px;line-height:.98;font-weight:700;text-transform:uppercase}}
.t2{{font-size:150px;line-height:.95;font-weight:700}}
.huge{{font-size:198px;line-height:.92;font-weight:700;letter-spacing:-.01em;white-space:nowrap}}
.huge2{{font-size:142px;line-height:1;font-weight:700}}
.big{{font-size:140px;font-weight:700;line-height:1}}
.teal{{color:{TEAL}}} .red{{color:{RED}}} .white{{color:#fff}} .dim{{opacity:.6}}
.hl{{display:inline-block;padding:0 22px;line-height:1.05}}
.hl.red{{background:{RED};color:#fff}} .hl.teal{{background:{TEAL}}} .ink{{color:{INK}!important}}
.kicker,.step{{font-size:34px;text-transform:uppercase}}
.step{{color:{RED}}} .dark .step{{color:{TEAL}}}
.row{{display:flex;gap:22px;font-size:40px}}
.glitch{{text-shadow:6px 0 rgba(255,59,31,.75),-6px 0 rgba(43,224,168,.6)}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}
.card{{background:#fff;border-radius:22px;padding:30px;box-shadow:0 18px 40px rgba(0,0,0,.08);display:flex;flex-direction:column;gap:10px;height:220px}}
.card b{{font-size:56px;font-weight:700}} .card small{{font-size:28px;opacity:.55}}
.ava{{width:70px;height:70px;border-radius:50%}} .ava0{{background:#ffb4a6}} .ava1{{background:#9ee8cf}} .ava2{{background:#ffd76a}} .ava3{{background:#b9c2ff}}
.weeks{{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}}
.wk{{display:flex;flex-direction:column;gap:10px}} .wk i{{display:block;height:26px;background:{INK};border-radius:6px;transform-origin:left}} .wk small{{font-size:24px;opacity:.6}}
.eq{{display:flex;flex-direction:column;gap:30px;margin-top:20px}}
#s03-a{{position:absolute;top:-10px;left:0;font-size:300px;color:{TEAL}}}
.clock{{font-size:270px;font-weight:700;color:#fff;margin-top:40px}}
.win{{border-radius:26px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.35)}}
.dark-win{{background:#161a20;border:2px solid #252b33}} .light-win{{background:#fff}}
.bar{{height:62px;display:flex;align-items:center;gap:12px;padding:0 24px;background:rgba(127,127,127,.12)}}
.bar i{{width:16px;height:16px;border-radius:50%;background:#8a8f96;opacity:.6}} .bar span{{margin-left:16px;font-size:26px;opacity:.7}}
.msg{{margin:30px;padding:26px 30px;background:#232933;border-radius:18px;font-size:36px;line-height:1.4;color:#e9e6e1}}
.ans{{padding:0 30px 34px;display:flex;flex-direction:column;gap:16px}}
.li{{font-size:38px;color:#e9e6e1}}
.wf{{padding:26px;display:grid;grid-template-columns:1.6fr 1fr;grid-template-rows:56px 280px 150px 90px;gap:20px}}
.wf .nav{{grid-column:1/3;background:{INK};border-radius:12px}}
.wf .hero{{background:#dcdcdc;border-radius:16px;display:flex;align-items:flex-end;padding:26px}}
.wf .hero b{{font-size:58px;line-height:.95;color:#fff;font-weight:700}}
.wf .side{{background:#e4e4e4;border:3px dashed #c9c9c9;border-radius:16px}}
.wf .tri{{grid-column:1/3;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}} .wf .tri div{{background:#e4e4e4;border:3px dashed #c9c9c9;border-radius:14px}}
.wf .foot{{grid-column:1/3;background:{INK};border-radius:12px}}
.note{{font-size:34px;opacity:.75}}
.code{{padding:34px;font-size:36px;line-height:1.6;color:#d8dde3}} .cl{{white-space:pre}}
.c{{color:#6b7480}} .s{{color:{TEAL}}} .f{{color:#ffb86b}}
.btnrow{{display:flex;align-items:center;gap:26px}}
.cta{{background:{RED};color:#fff;font-size:54px;font-weight:700;padding:26px 46px;border-radius:999px}}
.tag{{font-size:34px;color:{TEAL}}}
.dev{{align-self:center;background:#fff;border:14px solid {INK};overflow:hidden;width:900px;height:600px}}
.scr{{padding:22px;display:flex;flex-direction:column;gap:16px;height:100%}}
.hero2{{background:{RED};color:#fff;font-size:60px;font-weight:700;line-height:.95;padding:30px;border-radius:14px;flex:0 0 auto}}
.g1,.g2,.g3{{background:#e4e4e4;border-radius:12px;flex:1}}
.url{{font-size:48px;background:#161a20;border:2px solid #252b33;border-radius:18px;padding:30px;color:#e9e6e1}}
.prog{{height:30px;background:#20262e;border-radius:11px;overflow:hidden}} .prog i{{display:block;height:100%;background:{TEAL};transform-origin:left}}
.ok{{align-self:flex-start;background:{TEAL};color:{INK};font-size:90px;font-weight:700;padding:18px 40px;border-radius:18px}}
.vs{{display:flex;flex-direction:column;gap:34px;margin-top:20px}}
.was,.now{{position:relative;border-radius:26px;padding:40px 44px;display:flex;flex-direction:column;gap:6px}}
.was{{background:#dcd7cf}} .now{{background:{INK};color:#fff}}
.was small,.now small{{font-size:32px}} .was b,.now b{{font-size:120px;line-height:1;font-weight:700}}
.strike{{position:absolute;left:30px;right:30px;top:55%;height:14px;background:{RED};transform-origin:left;transform:rotate(-4deg)}}
.pills{{display:flex;flex-direction:column;gap:18px}}
.pill{{background:{INK};color:#fff;font-size:66px;font-weight:700;padding:16px 34px;border-radius:16px;display:flex;align-items:center;gap:26px}}
.pill span{{font-size:30px;opacity:.6}} .pill.hot{{background:{RED}}}
.rain{{position:absolute;inset:0;opacity:0}} .rc{{position:absolute;top:0;font-size:34px;line-height:1.5;color:{TEAL}}}
.zero{{display:flex;align-items:baseline;gap:26px}} .zero b{{font-size:220px;font-weight:700;color:#fff;line-height:.9}} .zero span{{font-size:40px;color:#e9e6e1}}
.tag2{{font-size:56px;color:{TEAL}}}
.tg{{display:flex;align-items:center;gap:24px;background:#fff;color:{INK};padding:26px 36px;border-radius:999px;align-self:flex-start}}
.tg .plane{{width:74px;height:74px;border-radius:50%;background:#2aa3e0;color:#fff;font-size:40px;display:flex;align-items:center;justify-content:center}}
.tg .mono{{font-size:42px}}
.small-cap{{font-size:40px;text-transform:uppercase;letter-spacing:.2em}}
#s14-s{{font-size:126px}}
.hdr{{position:absolute;top:186px;left:70px;right:70px;display:flex;justify-content:space-between;font-size:28px;letter-spacing:.12em;color:#fff;mix-blend-mode:difference;z-index:20}}
.fc{{position:absolute;right:0;top:0}}
.foot{{position:absolute;left:70px;right:70px;bottom:250px;z-index:20;mix-blend-mode:difference}}
.track{{height:6px;background:rgba(255,255,255,.25);border-radius:3px;overflow:hidden}} #pbar{{height:100%;background:#fff;transform-origin:left}}
.caps{{position:absolute;inset:0;z-index:30;pointer-events:none}}
.cap{{position:absolute;left:0;right:0;top:1195px;text-align:center;opacity:0}}
.chip{{display:inline-block;max-width:900px;font-size:76px;line-height:1.08;font-weight:700;padding:8px 26px;box-decoration-break:clone;-webkit-box-decoration-break:clone}}
.cap.dark .chip{{background:#fff;color:{INK}}} .cap.light .chip{{background:{INK};color:#fff}} .cap.red .chip{{background:#fff;color:{INK}}}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
{chr(10).join(html)}
<div class="hdr mono"><span>САЙТ ЗА ВЕЧЕР · ВСЁ КОДОМ</span><span style="position:relative;width:260px;text-align:right">{counters}</span></div>
<div class="foot"><div class="track"><div id="pbar"></div></div></div>
<div id="captions" class="caps" data-track-kind="captions">
{chr(10).join(caps)}
</div>
<audio id="voice" class="clip" src="assets/voice.wav" data-start="0" data-duration="{DUR}" data-track-index="2" data-volume="1"></audio>
{chr(10).join(audio)}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
window.__timelines["main"] = tl;
</script>
</body>
</html>
'''
open("index.html", "w", encoding="utf-8").write(page)
print("scenes", len(SCENES), "caption groups", len(groups), "sfx", SFX_N[0])

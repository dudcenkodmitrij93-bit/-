"""Точка входа для Яндекс Cloud Functions (index.handler).

Функцию запускает триггер-таймер 7 раз в день. Номер поста считается по
времени запуска, поэтому хранить state.json не нужно: каждый слот
расписания соответствует своему посту, и посты идут по кругу.

Переменные окружения функции:
  THREADS_ACCESS_TOKEN  — токен Threads API (обязательно)
  START_DATE            — день, с которого считаются слоты (по умолчанию ниже)
  START_INDEX           — номер поста, который выходит в первый слот START_DATE

Тест без публикации: запустить функцию с входными данными {"dry_run": true}.
"""

import json
import os
from datetime import date, datetime, timedelta, timezone

import bot

MSK = timezone(timedelta(hours=3))
# Часы публикаций по Москве. Должны совпадать с cron-выражением триггера.
SLOTS = [8, 10, 12, 14, 16, 18, 20]
START_DATE = "2026-11-10"
START_INDEX = 37


def post_index(now, total):
    """Номер поста для слота расписания, в который попадает момент now."""
    start = date.fromisoformat(os.environ.get("START_DATE") or START_DATE)
    start_index = int(os.environ.get("START_INDEX") or START_INDEX)
    day = now.date()
    passed = [s for s in SLOTS if s <= now.hour]
    if passed:
        slot = SLOTS.index(passed[-1])
    else:
        # До первого слота дня — считаем последний слот вчерашнего дня.
        day -= timedelta(days=1)
        slot = len(SLOTS) - 1
    n = (day - start).days * len(SLOTS) + slot
    return (start_index + n) % total


def load_posts():
    posts = json.loads(bot.POSTS_FILE.read_text(encoding="utf-8"))
    tg = os.environ.get("TELEGRAM_URL") or bot.TELEGRAM_URL
    bot_url = os.environ.get("TELEGRAM_BOT_URL") or bot.TELEGRAM_BOT_URL
    for i, p in enumerate(posts):
        p["text"] = p["text"].replace("{tg}", tg).replace("{bot}", bot_url)
        if len(p["text"]) > bot.MAX_TEXT:
            raise ValueError(f"Пост #{i} длиннее {bot.MAX_TEXT} символов")
    return posts


def handler(event, context):
    posts = load_posts()
    index = post_index(datetime.now(MSK), len(posts))
    post = posts[index]

    if isinstance(event, dict) and event.get("dry_run"):
        return {"statusCode": 200, "body": f"[dry-run] пост #{index}\n\n{post['text']}"}

    token = os.environ.get("THREADS_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("Не задан THREADS_ACCESS_TOKEN")
    topic = os.environ.get("THREADS_TOPIC", bot.TOPIC)
    user_id = os.environ.get("THREADS_USER_ID") or "me"
    post_id = bot.publish(post, token, user_id, topic)
    print(f"Опубликован пост #{index}, id {post_id}")
    return {"statusCode": 200, "body": f"пост #{index}, id {post_id}"}

#!/usr/bin/env python3
"""Бот для Threads: публикует следующий пост из posts.json.

Запускается по расписанию (GitHub Actions, 5 раз в день). За один запуск
публикует ровно один пост и сдвигает счётчик в state.json, поэтому посты
идут по кругу и не повторяются подряд.

Переменные окружения:
  THREADS_ACCESS_TOKEN  — долгоживущий токен Threads API (обязательно)
  THREADS_USER_ID       — id профиля Threads (по умолчанию "me")
  TELEGRAM_URL          — ссылка на ТГ-канал (по умолчанию из константы ниже)
  IMAGE_BASE_URL        — публичный адрес папки с картинками; если не задан,
                          берётся raw.githubusercontent.com текущего репозитория

Запуск:
  python bot.py              — опубликовать следующий пост
  python bot.py --dry-run    — показать, что будет опубликовано, без публикации
  python bot.py --refresh-token — продлить токен ещё на 60 дней
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://graph.threads.net/v1.0"
HERE = Path(__file__).resolve().parent
POSTS_FILE = HERE / "posts.json"
STATE_FILE = HERE / "state.json"
MAX_TEXT = 500  # лимит Threads на длину поста

# Ссылка на ТГ-канал: подставляется в посты вместо {tg}.
# Можно переопределить переменной окружения TELEGRAM_URL.
TELEGRAM_URL = "https://t.me/dudchenko_dmitry"


def request(method, url, params):
    data = urllib.parse.urlencode(params).encode()
    if method == "GET":
        url, data = f"{url}?{data.decode()}", None
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"Threads API {e.code}: {e.read().decode(errors='replace')}")


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"next_index": 0}


def save_state(state):
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def image_url(path):
    base = os.environ.get("IMAGE_BASE_URL")
    if not base:
        repo = os.environ.get("GITHUB_REPOSITORY")
        branch = os.environ.get("GITHUB_REF_NAME", "main")
        if not repo:
            return None
        base = f"https://raw.githubusercontent.com/{repo}/{branch}"
    return f"{base.rstrip('/')}/{urllib.parse.quote(path)}"


def publish(post, token, user_id):
    params = {"text": post["text"], "access_token": token}
    url = image_url(post["image"]) if post.get("image") else None
    if url:
        params.update(media_type="IMAGE", image_url=url)
    else:
        params["media_type"] = "TEXT"

    container = request("POST", f"{API}/{user_id}/threads", params)
    # Threads советует подождать, пока контейнер обработается.
    time.sleep(30 if url else 5)
    result = request(
        "POST",
        f"{API}/{user_id}/threads_publish",
        {"creation_id": container["id"], "access_token": token},
    )
    return result["id"]


def refresh_token(token):
    result = request(
        "GET",
        "https://graph.threads.net/refresh_access_token",
        {"grant_type": "th_refresh_token", "access_token": token},
    )
    days = result.get("expires_in", 0) // 86400
    print(f"Новый токен (действует ~{days} дн.):\n{result['access_token']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--refresh-token", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("THREADS_ACCESS_TOKEN")
    if not token and not args.dry_run:
        sys.exit("Не задан THREADS_ACCESS_TOKEN")
    if args.refresh_token:
        refresh_token(token)
        return

    posts = json.loads(POSTS_FILE.read_text(encoding="utf-8"))
    tg = os.environ.get("TELEGRAM_URL") or TELEGRAM_URL
    if "your_channel" in tg and not args.dry_run:
        sys.exit("Укажите ссылку на ТГ-канал в TELEGRAM_URL")
    for i, p in enumerate(posts):
        p["text"] = p["text"].replace("{tg}", tg)
        if len(p["text"]) > MAX_TEXT:
            sys.exit(f"Пост #{i} длиннее {MAX_TEXT} символов")

    state = load_state()
    index = state["next_index"] % len(posts)
    post = posts[index]

    if args.dry_run:
        print(f"[dry-run] пост #{index}, картинка: {post.get('image') or '—'}")
        print(post["text"])
        return

    post_id = publish(post, token, os.environ.get("THREADS_USER_ID") or "me")
    print(f"Опубликован пост #{index}, id {post_id}")
    state["next_index"] = index + 1
    save_state(state)


if __name__ == "__main__":
    main()

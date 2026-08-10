import asyncio
import html
import re
import sqlite3
from contextlib import contextmanager
from typing import Iterator

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from settings import settings


router = APIRouter()
DB_FILE = settings.db_file
SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


@contextmanager
def db_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(DB_FILE)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_chat_db() -> None:
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with db_connection() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                nickname TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS chat_msgs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                direction TEXT,
                content TEXT,
                is_read INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )


def cleanup_expired_data() -> tuple[int, int]:
    cutoff = f"-{settings.data_retention_hours} hours"
    with db_connection() as conn:
        deleted_messages = conn.execute(
            "DELETE FROM chat_msgs WHERE created_at < datetime('now', ?)",
            (cutoff,),
        ).rowcount
        deleted_sessions = conn.execute(
            """DELETE FROM chat_sessions
               WHERE created_at < datetime('now', ?)
                 AND NOT EXISTS (
                     SELECT 1 FROM chat_msgs
                     WHERE chat_msgs.session_id = chat_sessions.session_id
                 )""",
            (cutoff,),
        ).rowcount
    return deleted_sessions, deleted_messages


async def cleanup_expired_data_loop() -> None:
    while True:
        deleted_sessions, deleted_messages = cleanup_expired_data()
        if deleted_sessions or deleted_messages:
            print(
                "[客服系统] 已清理过期数据: "
                f"{deleted_sessions} 个会话, {deleted_messages} 条消息"
            )
        await asyncio.sleep(settings.cleanup_interval_seconds)


def _validate_session_id(session_id: object) -> str:
    if not isinstance(session_id, str):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    session_id = session_id.strip()
    if (
        not session_id
        or len(session_id) > settings.max_session_id_length
        or not SESSION_ID_PATTERN.fullmatch(session_id)
    ):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    return session_id


def _validate_text(value: object, field: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    value = value.strip()
    if not value or len(value) > maximum:
        raise HTTPException(status_code=400, detail=f"Invalid {field}")
    return value


def _telegram_text(value: str) -> str:
    return html.escape(value, quote=False)


init_chat_db()


async def send_tg_message(text: str) -> None:
    if not settings.telegram_enabled:
        return
    url = f"https://api.telegram.org/bot{settings.tg_bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(
            timeout=settings.tg_http_timeout_seconds
        ) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": settings.tg_admin_id,
                    "text": text,
                    "parse_mode": "HTML",
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        print(f"[客服系统] Telegram 消息发送失败: {exc}")


async def send_tg_photo(caption: str, file_bytes: bytes, filename: str) -> None:
    if not settings.telegram_enabled:
        return
    url = f"https://api.telegram.org/bot{settings.tg_bot_token}/sendPhoto"
    try:
        async with httpx.AsyncClient(
            timeout=settings.tg_http_timeout_seconds
        ) as client:
            response = await client.post(
                url,
                data={
                    "chat_id": settings.tg_admin_id,
                    "caption": caption,
                    "parse_mode": "HTML",
                },
                files={"photo": (filename, file_bytes)},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        print(f"[客服系统] Telegram 图片发送失败: {exc}")


async def telegram_polling_loop() -> None:
    if not settings.telegram_enabled:
        print("[客服系统] 未配置 Telegram Token 或管理员 ID，监听未启动")
        return

    offset = 0
    request_timeout = max(
        settings.tg_http_timeout_seconds,
        settings.tg_long_poll_timeout_seconds + 5,
    )
    print("[客服系统] Telegram 监听已启动")
    while True:
        try:
            url = (
                f"https://api.telegram.org/bot{settings.tg_bot_token}/getUpdates"
            )
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                response = await client.get(
                    url,
                    params={
                        "offset": offset,
                        "timeout": settings.tg_long_poll_timeout_seconds,
                    },
                )
                response.raise_for_status()
                for item in response.json().get("result", []):
                    offset = item["update_id"] + 1
                    message = item.get("message", {})
                    if str(message.get("chat", {}).get("id")) != settings.tg_admin_id:
                        continue
                    if "text" not in message or "reply_to_message" not in message:
                        continue
                    reply_to = message["reply_to_message"]
                    original = reply_to.get("text") or reply_to.get("caption") or ""
                    match = re.search(r"ID: ([A-Za-z0-9_-]+)", original)
                    if not match:
                        continue
                    target_sid = match.group(1)
                    with db_connection() as conn:
                        conn.execute(
                            """INSERT INTO chat_msgs
                               (session_id, direction, content)
                               VALUES (?, 'out', ?)""",
                            (target_sid, message["text"]),
                        )
                    print(f"[客服系统] 已回复用户 {target_sid}")
        except asyncio.CancelledError:
            raise
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            print(f"[客服系统] Telegram 轮询失败: {exc}")
            await asyncio.sleep(settings.tg_retry_delay_seconds)
        await asyncio.sleep(settings.tg_poll_interval_seconds)


@router.post("/api/chat/login")
async def chat_login(request: Request):
    data = await request.json()
    session_id = _validate_session_id(data.get("session_id"))
    nickname = _validate_text(
        data.get("nickname"), "nickname", settings.max_nickname_length
    )
    with db_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO chat_sessions
               (session_id, nickname) VALUES (?, ?)""",
            (session_id, nickname),
        )
    await send_tg_message(
        "<b>新客户接入</b>\n"
        f"称呼: {_telegram_text(nickname)}\n"
        f"ID: {_telegram_text(session_id)}"
    )
    return {"success": True}


@router.post("/api/chat/send")
async def chat_send(request: Request):
    data = await request.json()
    session_id = _validate_session_id(data.get("session_id"))
    content = _validate_text(
        data.get("content"), "content", settings.max_message_length
    )
    with db_connection() as conn:
        result = conn.execute(
            "SELECT nickname FROM chat_sessions WHERE session_id=?",
            (session_id,),
        ).fetchone()
        nickname = result[0] if result else "未知用户"
        conn.execute(
            """INSERT INTO chat_msgs (session_id, direction, content)
               VALUES (?, 'in', ?)""",
            (session_id, content),
        )
    await send_tg_message(
        "<b>客户消息</b>\n"
        f"称呼: {_telegram_text(nickname)}\n"
        f"ID: {_telegram_text(session_id)}\n"
        "------------------\n"
        f"{_telegram_text(content)}\n"
        "------------------\n"
        "<i>请回复此消息</i>"
    )
    return {"success": True}


@router.post("/api/chat/upload")
async def chat_upload(
    session_id: str = Form(...), file: UploadFile = File(...)
):
    session_id = _validate_session_id(session_id)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    file_bytes = await file.read(settings.max_upload_bytes + 1)
    if len(file_bytes) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image is too large")

    with db_connection() as conn:
        result = conn.execute(
            "SELECT nickname FROM chat_sessions WHERE session_id=?",
            (session_id,),
        ).fetchone()
        nickname = result[0] if result else "未知用户"
        conn.execute(
            """INSERT INTO chat_msgs (session_id, direction, content)
               VALUES (?, 'in', ?)""",
            (session_id, "[发送了一张图片]"),
        )

    caption = (
        "<b>客户图片</b>\n"
        f"称呼: {_telegram_text(nickname)}\n"
        f"ID: {_telegram_text(session_id)}\n"
        "<i>请回复此图片</i>"
    )
    await send_tg_photo(caption, file_bytes, file.filename or "upload")
    return {"success": True}


@router.get("/api/chat/poll")
async def chat_poll(session_id: str):
    session_id = _validate_session_id(session_id)
    with db_connection() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """SELECT * FROM (
                   SELECT * FROM chat_msgs
                   WHERE session_id=?
                   ORDER BY id DESC
                   LIMIT ?
               ) ORDER BY id ASC""",
            (session_id, settings.poll_limit),
        ).fetchall()
    return {"messages": [dict(row) for row in rows]}

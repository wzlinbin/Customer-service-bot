import asyncio
import secrets
from contextlib import asynccontextmanager, suppress
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from chat_router import (
    cleanup_expired_data_loop,
    router as chat_router,
    telegram_polling_loop,
)
from settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    polling_task = asyncio.create_task(telegram_polling_loop())
    cleanup_task = asyncio.create_task(cleanup_expired_data_loop())
    try:
        yield
    finally:
        for task in (polling_task, cleanup_task):
            task.cancel()
        for task in (polling_task, cleanup_task):
            with suppress(asyncio.CancelledError):
                await task


base_dir = Path(__file__).parent
chat_api_key = settings.chat_api_key

app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


@app.middleware("http")
async def require_chat_api_key(request: Request, call_next):
    path = request.url.path
    is_chat_api = path == "/api/chat" or path.startswith("/api/chat/")
    is_widget_asset = path.startswith("/static/")

    if request.method != "OPTIONS" and (is_chat_api or is_widget_asset):
        if not chat_api_key:
            return JSONResponse(
                status_code=503,
                content={"detail": "Service unavailable"},
            )

        supplied_key = request.headers.get("X-API-Key", "")
        if not secrets.compare_digest(supplied_key, chat_api_key):
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized"},
            )

    return await call_next(request)


app.include_router(chat_router)  # 挂载路由
app.mount("/static", StaticFiles(directory=base_dir / "static"), name="static")

if __name__ == "__main__":
    print(f"客服服务监听: http://{settings.app_host}:{settings.app_port}")
    uvicorn.run(app, host=settings.app_host, port=settings.app_port)

import asyncio
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# 引入我们写好的插件
from chat_router import router as chat_router, telegram_polling_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    polling_task = asyncio.create_task(telegram_polling_loop())
    try:
        yield
    finally:
        polling_task.cancel()
        with suppress(asyncio.CancelledError):
            await polling_task


base_dir = Path(__file__).parent
allowed_origins = [
    origin.strip()
    for origin in os.getenv("CHAT_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
allowed_origin_regex = os.getenv(
    "CHAT_ALLOWED_ORIGIN_REGEX",
    r"(?i)^https?://(?:[a-z0-9-]+\.)+api2cn\.com(?::\d+)?$"
    r"|^https?://(?:127\.0\.0\.1|localhost)(?::\d+)?$",
)

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.include_router(chat_router)  # 挂载路由
app.mount("/static", StaticFiles(directory=base_dir / "static"), name="static")

templates = Jinja2Templates(directory=base_dir / "templates")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    # 返回一个简单的包含聊天挂件的页面
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"request": request},
    )

if __name__ == "__main__":
    print("请访问: http://127.0.0.1:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)

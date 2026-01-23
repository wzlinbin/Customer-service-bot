from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import uvicorn
import asyncio

# 引入我们写好的插件
from chat_router import router as chat_router, telegram_polling_loop

app = FastAPI()
app.include_router(chat_router) # 挂载路由

templates = Jinja2Templates(directory="templates")

# 启动时开启 TG 监听
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telegram_polling_loop())

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    # 返回一个简单的包含聊天挂件的页面
    return templates.TemplateResponse("index.html", {"request": request})

if __name__ == "__main__":
    print("请访问: http://127.0.0.1:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)

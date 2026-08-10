全部内容来自AI操作
这是一个基于 **FastAPI** 和 **Telegram Bot** 的轻量级网页在线客服系统。
用户在网页端发送消息（支持文本和图片），管理员在 Telegram 接收并直接回复，系统会自动将回复推送到网页端。

## ✨ 功能特性

* **轻量级**：无需 Redis 或复杂数据库，使用 SQLite。
* **双向通讯**：
    * 用户 -> 网页 -> Telegram
    * 管理员 -> Telegram (引用回复) -> 网页
* **支持图片**：用户可以直接发送图片截图。
* **强制昵称**：用户开始聊天前需输入称呼，方便管理。
* **即插即用**：可以轻松集成到任何 FastAPI 项目中。
* **UI 美观**：现代化的悬浮胶囊按钮，适配移动端。

## 🛠️ 安装与运行

### 1. 克隆仓库
```bash
git clone https://github.com/wzlinbin/Customer-service-bot.git
cd Customer-service-bot
```

### 2. 安装依赖
```bash
pip install -r requirements.txt
```
### 3. 配置机器人
打开 chat_router.py修改
TG_BOT_TOKEN = "你的_TOKEN"
TG_ADMIN_ID = "你的_ID"
这两段

### 4. 运行示例
```bash
python main.py
```
打开浏览器访问 http://127.0.0.1:8000 即可看到效果。

ARM64 服务器使用 root、Python 虚拟环境和 systemd 持续运行的部署步骤见：
[ARM64 服务器部署指南](docs/ARM64_DEPLOYMENT.md)。

🧩 如何集成到你的项目中
复制文件：将 chat_router.py 和 templates/chat_widget.html 复制到你的项目。
挂载路由 (main.py)：
```bash
from chat_router import router as chat_router, telegram_polling_loop

app.include_router(chat_router)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telegram_polling_loop())
```

引入前端： 在你的 HTML 模板底部加入
```bash
{% include 'chat_widget.html' %}
```
![截图](https://github.com/user-attachments/assets/96b579a6-6117-4584-9ebb-dec93e1ccafa)

## Sub2API 安全集成

生产环境使用服务端代理：

    浏览器
      -> api.api2cn.com/customer-service/*
        -> Sub2API 服务端添加 X-API-Key
          -> custom.api2cn.com

固定密钥不会写入网页或 chat-widget.js。客服服务端会关闭根页面、API 文档，
并要求所有静态挂件和聊天 API 请求携带正确的 X-API-Key。

Sub2API 补丁、双方环境变量、自定义镜像构建和验证步骤见：
[Sub2API 安全集成指南](integrations/sub2api/README.md)。



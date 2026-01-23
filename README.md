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
git clone [https://github.com/your-username/fastapi-telegram-support.git](https://github.com/your-username/fastapi-telegram-support.git)
cd fastapi-telegram-support







123

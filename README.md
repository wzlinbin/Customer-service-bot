全部内容来自AI操作
这是一个基于 **FastAPI** 和 **Telegram Bot** 的轻量级网页在线客服系统。
用户在网页端发送消息（支持文本和图片），管理员在 Telegram 接收并直接回复，系统会自动将回复推送到网页端。

> Cloudflare Workers 版本位于 `cf-worker` 分支，使用 Workers + D1 + Telegram
> Webhook。部署步骤见 [Cloudflare Workers 部署文档](docs/CLOUDFLARE_WORKERS_DEPLOYMENT.md)。

## ✨ 功能特性

* **轻量级**：无需 Redis 或复杂数据库，使用 SQLite。
* **双向通讯**：
    * 用户 -> 网页 -> Telegram
    * 管理员 -> Telegram (引用回复) -> 网页
* **支持图片**：用户可以直接发送图片截图。
* **强制昵称**：用户开始聊天前需输入称呼，方便管理。
* **临时浏览器会话**：关闭浏览器会话后清除本地会话标识，再次打开不会显示之前的聊天记录。
* **多语言界面**：根据浏览器语言自动切换英文、德语、西班牙语、日语、简体中文或繁体中文，不匹配时使用简体中文。
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
配置文件固定放在项目根目录：

```bash
cp customer-service-bot.env.example customer-service-bot.env
```

编辑 `customer-service-bot.env`，至少填写：

```env
TG_BOT_TOKEN=你的_TOKEN
TG_ADMIN_ID=你的_ID
CHAT_API_KEY=你生成的共享密钥
```

程序会自动读取该文件。操作系统或 systemd 中已经存在的同名环境变量优先级更高。
真实配置文件已被 `.gitignore` 排除，请勿提交到 Git。

其他可配置项包括监听地址和端口、数据库路径、CORS、消息和上传限制、Telegram
轮询参数，以及临时聊天数据的保留与清理周期。完整配置见
`customer-service-bot.env.example`。



# 安装服务
nano /etc/systemd/system/customer-service-bot.service

    [Unit]
    Description=Customer Service Bot
    Wants=network-online.target
    After=network-online.target

    [Service]
    Type=simple
    User=root
    Group=root
    WorkingDirectory=/root/Customer-service-bot
    EnvironmentFile=/root/Customer-service-bot/customer-service-bot.env
    Environment=PYTHONUNBUFFERED=1
    ExecStart=/root/Customer-service-bot/.venv/bin/python /root/Customer-service-bot/main.py
    Restart=always
    RestartSec=5
    TimeoutStopSec=30
    KillSignal=SIGINT
    UMask=0077

    NoNewPrivileges=true
    PrivateTmp=true
    ProtectSystem=full
    ReadWritePaths=/root/Customer-service-bot

    [Install]
    WantedBy=multi-user.target


### 4. 运行示例

sudo systemctl enable customer-service-bot
sudo systemctl start customer-service-bot

# ARM64 服务器部署指南

本文以 Ubuntu 22.04/24.04 或 Debian 12 ARM64 服务器为例，使用 root 账户、
Python 虚拟环境和 systemd 部署客服系统。

本文只负责应用本身的安装和持续后台运行，公网接入部分由你另行处理。

应用结构：

    Uvicorn 127.0.0.1:8000
      ├─ FastAPI
      ├─ Telegram 长轮询
      ├─ 静态客服挂件
      └─ SQLite chat.db

## 1. 部署前准备

需要准备：

- ARM64 服务器，建议至少 1 核 CPU、1 GB 内存。
- Ubuntu 22.04/24.04 ARM64 或 Debian 12 ARM64。
- Telegram Bot Token 和管理员 Telegram ID。
- 服务器 root 权限。

切换为 root：

    sudo -i

确认当前账户和服务器架构：

    whoami
    uname -m

whoami 应显示 root，ARM64 通常显示 aarch64 或 arm64。

## 2. 安装系统依赖

    apt update
    apt install -y git python3 python3-venv python3-pip curl openssl

确认版本：

    python3 --version
    git --version

本项目依赖均支持 ARM64。若某个 Python 包需要本地编译，再安装：

    apt install -y build-essential python3-dev

## 3. 拉取项目

默认部署目录为 ~/Customer-service-bot：

    git clone \
      https://github.com/wzlinbin/Customer-service-bot.git \
      ~/Customer-service-bot

进入项目目录：

    cd ~/Customer-service-bot

确认入口文件存在：

    test -f main.py && echo "main.py OK"

如果目录中已经存在项目，使用：

    git -C ~/Customer-service-bot pull --ff-only

## 4. 创建 Python 虚拟环境

    python3 -m venv ~/Customer-service-bot/.venv

升级虚拟环境中的 pip：

    ~/Customer-service-bot/.venv/bin/python \
      -m pip install --upgrade pip

安装项目依赖：

    ~/Customer-service-bot/.venv/bin/python \
      -m pip install -r ~/Customer-service-bot/requirements.txt

检查关键依赖：

    ~/Customer-service-bot/.venv/bin/python \
      -c "import fastapi, uvicorn, httpx, jinja2; print('dependencies OK')"

不要把 .venv、chat.db 或 __pycache__ 提交到 Git 仓库。

## 5. 配置 Telegram

当前版本从 chat_router.py 顶部读取：

    TG_BOT_TOKEN = "你的 Bot Token"
    TG_ADMIN_ID = "你的 Telegram ID"

编辑配置：

    nano ~/Customer-service-bot/chat_router.py

限制配置文件权限：

    chown root:root ~/Customer-service-bot/chat_router.py
    chmod 600 ~/Customer-service-bot/chat_router.py

安全注意事项：

- 不要把真实 Token 提交或推送到 GitHub。
- 不要在工单、截图或日志中展示 Token。
- Token 如果曾公开，应立即通过 BotFather 重置。
- 更新代码前先备份 chat_router.py 中的本地配置。

### 配置服务端共享密钥

生成独立的 256 位随机密钥：

    openssl rand -hex 32

创建环境文件：

    nano /etc/customer-service-bot.env

写入生成的值：

    CHAT_API_KEY=替换为生成的共享密钥
    CHAT_ALLOWED_ORIGINS=https://api.api2cn.com

限制权限：

    chown root:root /etc/customer-service-bot.env
    chmod 600 /etc/customer-service-bot.env

该密钥必须与 Sub2API 的 CUSTOMER_SERVICE_API_KEY 相同。不能把它写入网页、
chat-widget.js 或 Git 仓库。

## 6. 前台测试

使用虚拟环境中的 Uvicorn 启动：

    cd ~/Customer-service-bot
    ./.venv/bin/python \
      -m uvicorn main:app \
      --host 127.0.0.1 \
      --port 8000 \
      --workers 1

另开一个 SSH 终端，加载密钥并检查：

    set -a
    source /etc/customer-service-bot.env
    set +a

    curl -i http://127.0.0.1:8000/
    curl -i http://127.0.0.1:8000/static/chat-widget.js
    curl -I \
      -H "X-API-Key: $CHAT_API_KEY" \
      http://127.0.0.1:8000/static/chat-widget.js

根路径应返回 404；不带密钥的挂件请求应返回 401；带正确密钥时应返回 200。
测试完成后在启动终端按 Ctrl+C。

必须保持 workers 为 1。多个 worker 会同时运行 Telegram getUpdates 长轮询，
导致回复争抢、重复监听或 Telegram 冲突；SQLite 也不适合当前模式下的多进程写入。

## 7. 使用 systemd 持续后台运行

创建服务文件：

    nano /etc/systemd/system/customer-service-bot.service

systemd 不会展开波浪号，因此服务文件中的项目路径必须写成
/root/Customer-service-bot，而不是 ~/Customer-service-bot。

写入：

    [Unit]
    Description=Customer Service Bot
    Wants=network-online.target
    After=network-online.target

    [Service]
    Type=simple
    User=root
    Group=root
    WorkingDirectory=/root/Customer-service-bot
    EnvironmentFile=/etc/customer-service-bot.env
    Environment=PYTHONUNBUFFERED=1
    ExecStart=/root/Customer-service-bot/.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers
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

加载服务并设置开机启动：

    systemctl daemon-reload
    systemctl enable --now customer-service-bot

检查运行状态：

    systemctl status customer-service-bot --no-pager

持续查看日志：

    journalctl -u customer-service-bot -f

查看最近 100 行：

    journalctl -u customer-service-bot -n 100 --no-pager

常用管理命令：

    systemctl restart customer-service-bot
    systemctl stop customer-service-bot
    systemctl start customer-service-bot

systemd 会在应用异常退出后等待 5 秒自动重启，也会在服务器重启后自动启动。

## 8. 验证 CORS

项目默认只允许正式网页域名和本机测试地址：

    https://api.api2cn.com
    http://127.0.0.1:任意端口
    https://127.0.0.1:任意端口
    http://localhost:任意端口
    https://localhost:任意端口

公网接入完成后，可以执行预检：

    curl -i -X OPTIONS \
      https://custom.api2cn.com/api/chat/login \
      -H "Origin: https://api.api2cn.com" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: content-type"

响应中应包含：

    Access-Control-Allow-Origin: https://api.api2cn.com

如需覆盖默认正则，可在 systemd 的 Service 区域增加：

    Environment=CHAT_ALLOWED_ORIGIN_REGEX=你的完整正则

修改服务文件后执行：

    systemctl daemon-reload
    systemctl restart customer-service-bot

## 9. 接入 Sub2API

浏览器不能再直接加载 custom.api2cn.com 的挂件或调用聊天 API。Sub2API
必须通过服务端代理添加 X-API-Key，共享密钥不会下发到浏览器。

完整补丁、环境变量、自定义镜像构建和验证步骤见
[Sub2API 安全集成指南](../integrations/sub2api/README.md)。

部署完成后，浏览器只访问同源路径：

    /customer-service/chat-widget.js
    /customer-service/api/chat/*

## 10. 更新项目

更新前停止服务并备份数据库和配置：

    systemctl stop customer-service-bot
    install -d -m 700 /var/backups/customer-service-bot
    cp ~/Customer-service-bot/chat.db \
      /var/backups/customer-service-bot/chat.db.backup
    cp ~/Customer-service-bot/chat_router.py \
      /var/backups/customer-service-bot/chat_router.py.backup

拉取代码：

    git -C ~/Customer-service-bot pull --ff-only

如果 chat_router.py 的本地 Token 配置与远程更新冲突，不要强制覆盖；
先解决配置差异并确认 Token 仍然正确。

更新依赖并重启：

    ~/Customer-service-bot/.venv/bin/python \
      -m pip install -r ~/Customer-service-bot/requirements.txt
    systemctl start customer-service-bot
    systemctl status customer-service-bot --no-pager

## 11. 数据与备份

chat.db 位于：

    ~/Customer-service-bot/chat.db

它保存昵称、会话 ID 和聊天文字。用户图片不会保存为本地文件，但会发送到
Telegram。当前版本不会自动清理 chat.db，长期运行时应定期备份、归档或增加
按时间清理功能。

不要在应用运行时直接删除 chat.db。需要恢复备份时，先停止服务：

    systemctl stop customer-service-bot
    cp /var/backups/customer-service-bot/chat.db.backup \
      ~/Customer-service-bot/chat.db
    chown root:root ~/Customer-service-bot/chat.db
    chmod 600 ~/Customer-service-bot/chat.db
    systemctl start customer-service-bot

## 12. 常见故障

### 应用无法访问

检查 systemd 和受保护的挂件资源：

    systemctl status customer-service-bot --no-pager
    set -a
    source /etc/customer-service-bot.env
    set +a
    curl -I \
      -H "X-API-Key: $CHAT_API_KEY" \
      http://127.0.0.1:8000/static/chat-widget.js

### 挂件脚本 404

确认文件存在：

    ls -l ~/Customer-service-bot/static/chat-widget.js

确认 systemd 的 WorkingDirectory 是 /root/Customer-service-bot，并重启服务。

### 浏览器提示 CORS 错误

浏览器正常情况下只请求 api.api2cn.com 的同源客服代理，不应直接请求
custom.api2cn.com。检查是否已经应用 Sub2API 补丁，以及挂件的
data-api-base 是否为 /customer-service。

### Telegram 收不到消息

检查：

- Bot Token 和管理员 ID 是否正确。
- 机器人是否已经与管理员开始过对话。
- 服务器能否访问 api.telegram.org。
- 是否误启动了多个应用实例或多个 Uvicorn worker。

查看日志：

    journalctl -u customer-service-bot -n 200 --no-pager

### Permission denied 或无法写入 chat.db

修复应用目录所有者：

    chown -R root:root ~/Customer-service-bot
    systemctl restart customer-service-bot

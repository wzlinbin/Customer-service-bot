# ARM64 服务器部署指南

本文以 Ubuntu 22.04/24.04 或 Debian 12 的 ARM64 服务器为例，将客服系统部署到
https://custom.api2cn.com，并由 https://api.api2cn.com 跨域加载客服挂件。

最终结构：

    浏览器
      └─ https://api.api2cn.com
           └─ 加载 https://custom.api2cn.com/static/chat-widget.js
                └─ 请求 https://custom.api2cn.com/api/chat/*

    Nginx :80/:443
      └─ Uvicorn 127.0.0.1:8000
           ├─ FastAPI
           ├─ Telegram 长轮询
           └─ SQLite chat.db

## 1. 部署前准备

需要准备：

- ARM64 云服务器，建议至少 1 核 CPU、1 GB 内存。
- Ubuntu 22.04/24.04 ARM64 或 Debian 12 ARM64。
- 域名 custom.api2cn.com 已解析到服务器公网 IP。
- Telegram Bot Token 和管理员 Telegram ID。
- 可使用 sudo 的 SSH 用户。

确认服务器架构：

    uname -m

ARM64 通常显示 aarch64 或 arm64。

确认 DNS 已生效：

    getent hosts custom.api2cn.com

## 2. 安装系统依赖

    sudo apt update
    sudo apt install -y git python3 python3-venv python3-pip nginx curl

确认版本：

    python3 --version
    nginx -v

本项目依赖均支持 ARM64。若某个 Python 包需要本地编译，再安装：

    sudo apt install -y build-essential python3-dev

## 3. 创建专用运行用户

不要使用 root 账户运行应用：

    sudo useradd --system \
      --home-dir /var/lib/customer-service-bot \
      --create-home \
      --shell /usr/sbin/nologin \
      customerbot

创建应用目录：

    sudo install -d \
      -o customerbot \
      -g customerbot \
      /opt/customer-service-bot

## 4. 拉取项目

    sudo -u customerbot git clone \
      https://github.com/wzlinbin/Customer-service-bot.git \
      /opt/customer-service-bot

进入项目目录：

    cd /opt/customer-service-bot

确认入口文件存在：

    test -f main.py && echo "main.py OK"

## 5. 创建 Python 虚拟环境

    sudo -u customerbot python3 -m venv \
      /opt/customer-service-bot/.venv

升级虚拟环境中的 pip：

    sudo -u customerbot \
      /opt/customer-service-bot/.venv/bin/python \
      -m pip install --upgrade pip

安装项目依赖：

    sudo -u customerbot \
      /opt/customer-service-bot/.venv/bin/python \
      -m pip install -r /opt/customer-service-bot/requirements.txt

检查关键依赖：

    sudo -u customerbot \
      /opt/customer-service-bot/.venv/bin/python \
      -c "import fastapi, uvicorn, httpx, jinja2; print('dependencies OK')"

不要把 .venv、chat.db 或 __pycache__ 提交到 Git 仓库。

## 6. 配置 Telegram

当前版本从 chat_router.py 顶部读取以下两项：

    TG_BOT_TOKEN = "你的 Bot Token"
    TG_ADMIN_ID = "你的 Telegram ID"

在服务器中编辑：

    sudo -u customerbot nano /opt/customer-service-bot/chat_router.py

配置完成后限制文件权限：

    sudo chmod 600 /opt/customer-service-bot/chat_router.py
    sudo chown customerbot:customerbot /opt/customer-service-bot/chat_router.py

安全注意事项：

- 不要把真实 Token 提交或推送到 GitHub。
- 不要在工单、截图或日志中展示 Token。
- Token 如果曾公开，应立即通过 BotFather 重置。
- 服务器更新代码前，先备份 chat_router.py 中的本地配置。

## 7. 前台测试

先用单进程启动：

    cd /opt/customer-service-bot
    sudo -u customerbot \
      /opt/customer-service-bot/.venv/bin/python \
      -m uvicorn main:app \
      --host 127.0.0.1 \
      --port 8000 \
      --workers 1

另开一个 SSH 终端检查：

    curl -I http://127.0.0.1:8000/
    curl -I http://127.0.0.1:8000/static/chat-widget.js

两个请求均应返回 200。测试完成后在启动终端按 Ctrl+C。

必须保持 workers 为 1。多个 worker 会同时运行 Telegram getUpdates 长轮询，
导致回复争抢、重复监听或 Telegram 冲突；SQLite 写入也不适合多进程并发。

## 8. 使用 systemd 持续运行

创建服务文件：

    sudo nano /etc/systemd/system/customer-service-bot.service

写入：

    [Unit]
    Description=Customer Service Bot
    Wants=network-online.target
    After=network-online.target

    [Service]
    Type=simple
    User=customerbot
    Group=customerbot
    WorkingDirectory=/opt/customer-service-bot
    Environment=PYTHONUNBUFFERED=1
    ExecStart=/opt/customer-service-bot/.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers
    Restart=always
    RestartSec=5
    TimeoutStopSec=30
    KillSignal=SIGINT
    UMask=0077

    NoNewPrivileges=true
    PrivateTmp=true
    ProtectSystem=full
    ProtectHome=true
    ReadWritePaths=/opt/customer-service-bot

    [Install]
    WantedBy=multi-user.target

加载配置并设置开机启动：

    sudo systemctl daemon-reload
    sudo systemctl enable --now customer-service-bot

检查状态：

    sudo systemctl status customer-service-bot --no-pager

持续查看日志：

    sudo journalctl -u customer-service-bot -f

查看最近 100 行：

    sudo journalctl -u customer-service-bot -n 100 --no-pager

常用管理命令：

    sudo systemctl restart customer-service-bot
    sudo systemctl stop customer-service-bot
    sudo systemctl start customer-service-bot

systemd 会在进程异常退出后等待 5 秒自动重启，也会在服务器重启后自动启动。

## 9. 配置 Nginx 反向代理

创建站点配置：

    sudo nano /etc/nginx/sites-available/customer-service-bot

写入：

    server {
        listen 80;
        listen [::]:80;
        server_name custom.api2cn.com;

        client_max_body_size 10m;

        location / {
            proxy_pass http://127.0.0.1:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }
    }

启用站点：

    sudo ln -s \
      /etc/nginx/sites-available/customer-service-bot \
      /etc/nginx/sites-enabled/customer-service-bot

检查配置并重载：

    sudo nginx -t
    sudo systemctl reload nginx

HTTP 验证：

    curl -I http://custom.api2cn.com/static/chat-widget.js

## 10. 配置 HTTPS

安装 Certbot：

    sudo apt install -y certbot python3-certbot-nginx

申请证书并让 Certbot 自动更新 Nginx：

    sudo certbot --nginx -d custom.api2cn.com

检查自动续期：

    sudo systemctl status certbot.timer --no-pager
    sudo certbot renew --dry-run

最终验证：

    curl -I https://custom.api2cn.com/
    curl -I https://custom.api2cn.com/static/chat-widget.js

不要直接向公网开放 8000 端口。公网只需开放 SSH、HTTP 和 HTTPS。

如果使用 UFW，先确认 SSH 规则，再启用防火墙：

    sudo ufw allow OpenSSH
    sudo ufw allow "Nginx Full"
    sudo ufw enable
    sudo ufw status

## 11. 验证 CORS

项目默认允许所有 api2cn.com 子域、127.0.0.1 和 localhost。

从服务器执行预检：

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

    sudo systemctl daemon-reload
    sudo systemctl restart customer-service-bot

## 12. 在目标网站嵌入

在 https://api.api2cn.com 页面结束标签前加入：

    <script
      src="https://custom.api2cn.com/static/chat-widget.js"
      data-api-base="https://custom.api2cn.com"
      defer>
    </script>

然后打开浏览器开发者工具检查：

- Network 中 chat-widget.js 返回 200。
- 点击按钮后出现昵称输入框。
- 提交昵称时 OPTIONS 和 /api/chat/login 均成功。
- 发送消息后 Telegram 管理员收到通知。
- Telegram 引用回复后，网页在约 2 秒内显示回复。

若目标网站有 Content-Security-Policy，需要允许：

    script-src https://custom.api2cn.com
    connect-src https://custom.api2cn.com
    style-src 'unsafe-inline'

不要直接覆盖现有 CSP；应把以上来源合并到网站原有规则中。

## 13. 更新项目

更新前停止服务并备份数据库和配置：

    sudo systemctl stop customer-service-bot
    sudo install -d -m 700 /var/backups/customer-service-bot
    sudo cp /opt/customer-service-bot/chat.db \
      /var/backups/customer-service-bot/chat.db.backup
    sudo cp /opt/customer-service-bot/chat_router.py \
      /var/backups/customer-service-bot/chat_router.py.backup

拉取代码：

    sudo -u customerbot git -C /opt/customer-service-bot pull --ff-only

如果 chat_router.py 的本地 Token 配置与远程更新冲突，不要强制覆盖；
先解决配置差异并确认 Token 仍然正确。

更新依赖并重启：

    sudo -u customerbot \
      /opt/customer-service-bot/.venv/bin/python \
      -m pip install -r /opt/customer-service-bot/requirements.txt
    sudo systemctl start customer-service-bot
    sudo systemctl status customer-service-bot --no-pager

## 14. 数据与备份

chat.db 位于：

    /opt/customer-service-bot/chat.db

它保存昵称、会话 ID 和聊天文字。用户图片不会保存为本地文件，但会发送到
Telegram。当前版本不会自动清理 chat.db，长期运行时应定期备份、归档或增加
按时间清理功能。

不要在应用运行时直接删除 chat.db。需要恢复备份时，先停止服务：

    sudo systemctl stop customer-service-bot
    sudo cp /var/backups/customer-service-bot/chat.db.backup \
      /opt/customer-service-bot/chat.db
    sudo chown customerbot:customerbot /opt/customer-service-bot/chat.db
    sudo chmod 600 /opt/customer-service-bot/chat.db
    sudo systemctl start customer-service-bot

## 15. 常见故障

### 502 Bad Gateway

检查应用是否运行：

    sudo systemctl status customer-service-bot --no-pager
    curl -I http://127.0.0.1:8000/
    sudo tail -n 100 /var/log/nginx/error.log

### 挂件脚本 404

确认文件存在：

    ls -l /opt/customer-service-bot/static/chat-widget.js

确认 systemd 的 WorkingDirectory 是 /opt/customer-service-bot，并重启服务。

### 浏览器提示 CORS 错误

检查请求的 Origin 是否属于 api2cn.com 子域、127.0.0.1 或 localhost，然后执行
第 11 节的预检命令。注意 Origin 包含协议和端口。

### Telegram 收不到消息

检查：

- Bot Token 和管理员 ID 是否正确。
- 机器人是否已经与管理员开始过对话。
- 服务器能否访问 api.telegram.org。
- 是否误启动了多个应用实例或多个 Uvicorn worker。

查看日志：

    sudo journalctl -u customer-service-bot -n 200 --no-pager

### Permission denied 或无法写入 chat.db

修复应用目录所有者：

    sudo chown -R customerbot:customerbot /opt/customer-service-bot
    sudo systemctl restart customer-service-bot


# Sub2API 安全集成

本集成让浏览器只访问 api.api2cn.com，由 Sub2API 服务端代理到
custom.api2cn.com。共享密钥只保存在两端服务器，不会出现在 HTML、
chat-widget.js 或浏览器请求中。

请求路径：

    浏览器
      -> https://api.api2cn.com/customer-service/*
        -> Sub2API 添加 X-API-Key
          -> https://custom.api2cn.com/api/chat/*

## 1. 生成共享密钥

在可信服务器上执行：

    openssl rand -hex 32

生成的 64 位十六进制值只保存到两端服务器。不要使用 Telegram Bot Token，
也不要把该值提交到 Git。

## 2. 配置客服服务

进入客服项目并从示例创建环境文件：

    cd ~/Customer-service-bot
    cp -n customer-service-bot.env.example customer-service-bot.env
    nano ~/Customer-service-bot/customer-service-bot.env

写入：

    CHAT_API_KEY=替换为生成的共享密钥
    CHAT_ALLOWED_ORIGINS=https://api.api2cn.com

限制权限：

    chown root:root ~/Customer-service-bot/customer-service-bot.env
    chmod 600 ~/Customer-service-bot/customer-service-bot.env

在 /etc/systemd/system/customer-service-bot.service 的 Service 区域加入：

    EnvironmentFile=/root/Customer-service-bot/customer-service-bot.env

重新加载：

    systemctl daemon-reload
    systemctl restart customer-service-bot

验证失败关闭：

    curl -i https://custom.api2cn.com/
    curl -i https://custom.api2cn.com/static/chat-widget.js

根路径应返回 404；不带密钥的挂件请求应返回 401。

带密钥的服务器端验证：

    set -a
    source ~/Customer-service-bot/customer-service-bot.env
    set +a
    curl -I \
      -H "X-API-Key: $CHAT_API_KEY" \
      https://custom.api2cn.com/static/chat-widget.js

该请求应返回 200。不要把这条带密钥命令的终端输出截图或分享。

## 3. 应用 Sub2API 补丁

补丁基于 Sub2API 提交 0b3fe95 生成。进入实际 Sub2API 仓库：

    cd ~/sub2api

先检查能否干净应用：

    git apply --check \
      ~/Customer-service-bot/integrations/sub2api/sub2api-customer-service.patch

应用补丁：

    git apply \
      ~/Customer-service-bot/integrations/sub2api/sub2api-customer-service.patch

运行后端测试：

    cd ~/sub2api/backend
    go test ./internal/server/routes -run TestCustomerService -count=1

补丁包含：

- 固定路径的客服代理，不允许代理任意 URL。
- 服务端添加 X-API-Key。
- 10 MiB 请求体限制。
- 禁止跟随上游重定向，避免密钥被转发到其他主机。
- 复用 Sub2API 的公共 IP 限流器。
- 同源加载客服挂件。
- Docker Compose 环境变量传递。

## 4. 配置 Sub2API

编辑 Sub2API 的 deploy/.env：

    CUSTOMER_SERVICE_BASE_URL=https://custom.api2cn.com
    CUSTOMER_SERVICE_API_KEY=与 CHAT_API_KEY 完全相同的共享密钥

限制文件权限：

    chmod 600 ~/sub2api/deploy/.env

如果 Sub2API 与客服服务在同一台服务器，也可以把 BASE_URL 配置为只在服务器
内部可达的地址，但必须确保该地址能从 Sub2API 容器或进程访问。

## 5. 构建 Sub2API 自定义镜像

官方 weishaw/sub2api:latest 不包含本补丁，必须从修改后的源码构建：

    cd ~/sub2api
    docker build -t sub2api-customer-service:local .

在 deploy/.env 中设置：

    SUB2API_IMAGE=sub2api-customer-service:local

然后按实际使用的 Compose 文件重建服务。例如：

    cd ~/sub2api/deploy
    docker compose -f docker-compose.local.yml up -d --force-recreate

查看日志：

    docker compose -f docker-compose.local.yml logs -f sub2api

## 6. 浏览器验证

补丁已经在 frontend/index.html 中加入：

    <script
      src="/customer-service/chat-widget.js?v=20260811-1"
      data-api-base="/customer-service"
      defer>
    </script>

验证代理挂件：

    curl -I https://api.api2cn.com/customer-service/chat-widget.js

应返回 200。带版本号的挂件由 Sub2API 返回一年期不可变缓存：

    Cache-Control: public, max-age=31536000, immutable

更新挂件内容时必须同步修改 frontend/index.html 中的 v 参数，否则浏览器会继续
使用当前版本。浏览器 Network 中的请求应为：

    /customer-service/chat-widget.js
    /customer-service/api/chat/login
    /customer-service/api/chat/send
    /customer-service/api/chat/upload
    /customer-service/api/chat/poll

浏览器请求中不应出现 X-API-Key。

## 7. 安全边界

- custom.api2cn.com 的根路径、文档和 OpenAPI 均不可用。
- custom.api2cn.com 的静态挂件与聊天 API 均要求 X-API-Key。
- Sub2API 只代理五类固定客服路径，不提供通用代理能力。
- 固定密钥只验证请求来自 Sub2API 服务端，不区分最终访客。
- Sub2API 的客服代理仍是面向网站访客的公开入口，应保留限流。
- 如需进一步防自动化滥用，应增加 Turnstile 或要求 Sub2API 登录态。

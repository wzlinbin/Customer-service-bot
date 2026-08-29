# Cloudflare Workers 部署

此版本保留现有 `/api/chat/*` 协议和 `static/chat-widget.js`，将运行时替换为：

- Cloudflare Worker：HTTP API、Telegram 消息发送与 Webhook。
- D1：替代本机 SQLite 文件。
- Cron Trigger：每小时清理过期聊天数据。
- Workers Static Assets：提供受保护的聊天小组件脚本。

Telegram 管理员回复必须使用 Webhook。Worker 不支持原 FastAPI 版本使用的常驻
`getUpdates` 长轮询任务。Worker 会在收到已鉴权的聊天请求时自动注册或修复 Webhook，
也会在每小时的定时任务中检查首次配置状态。

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm install
cp .dev.vars.example .dev.vars
npm run cf:migrate:local
npm run cf:dev
```

编辑 `.dev.vars`，填入本地开发值。该文件已被 Git 忽略。

默认地址为 `http://localhost:8787`。接口和 `/static/chat-widget.js` 都要求请求头：

```text
X-API-Key: <CHAT_API_KEY>
```

## 首次部署

1. 登录 Cloudflare，并检查 Worker 配置：

   ```bash
   npx wrangler login
   npx wrangler whoami
   ```

2. 逐个添加 Secret。命令会交互式读取值，不要把值直接写进命令行：

   ```bash
   npx wrangler secret put TG_BOT_TOKEN
   npx wrangler secret put TG_ADMIN_ID
   npx wrangler secret put CHAT_API_KEY
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```

   `TELEGRAM_WEBHOOK_SECRET` 使用字母、数字、下划线和连字符组成的随机值。

3. 部署 Worker。首次部署时 Wrangler 会自动创建 D1，并把资源 ID 写回
   `wrangler.jsonc`：

   ```bash
   npm run cf:deploy
   npm run cf:migrate:remote
   ```

4. Worker 会根据 `wrangler.jsonc` 中的 `TELEGRAM_WEBHOOK_URL` 自动把 Telegram Bot
   切换到 Webhook。也可以用下面的 PowerShell 命令手工重新注册；
   `webhookSecret` 必须与 Worker 的 `TELEGRAM_WEBHOOK_SECRET` 完全一致：

   ```powershell
   $botToken = Read-Host 'Telegram bot token'
   $webhookSecret = Read-Host 'Webhook secret'
   $workerUrl = (Read-Host 'Worker URL').TrimEnd('/')
   $body = @{
       url = "$workerUrl/telegram/webhook"
       secret_token = $webhookSecret
       allowed_updates = @('message')
   } | ConvertTo-Json
   Invoke-RestMethod -Method Post `
       -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
       -ContentType 'application/json' -Body $body
   ```

5. 验证配置和日志：

   ```bash
   npm run cf:check
   npx wrangler tail
   ```

## 配置

普通配置位于 `wrangler.jsonc` 的 `vars`：允许的浏览器 Origin、轮询消息数、
文本和上传大小限制、数据保留时间。修改配置后运行：

```bash
npm run cf:types
npm run cf:check
```

生产密钥只使用 `wrangler secret put` 或 Cloudflare Dashboard 的 Secret 类型，
不要放进 `vars`、源码或 Git。

## 小组件接入

出于现有安全模型，聊天 API 和脚本都要求 `X-API-Key`。浏览器的普通 `<script>`
标签不能设置这个请求头，因此生产站点应继续通过自己的同源服务端代理获取脚本并为
API 请求注入该请求头，不能把共享密钥下发到浏览器。

Worker 地址变化时，可在小组件脚本标签上设置 `data-api-base`，让 API 请求指向代理后的
公共路径。现有 ARM64 代理示例仍可参考 `docs/ARM64_DEPLOYMENT.md`。

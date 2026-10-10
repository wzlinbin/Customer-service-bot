# Customer Service Bot

基于 Cloudflare Workers、D1 和 Telegram Webhook 的网页客服系统，支持文字、图片和多语言悬浮窗口。统一使用 `main` 分支维护和发布。

## 首次部署

需要 Node.js 22 或更高版本、Cloudflare 账号和 Telegram Bot。

### 1. 获取代码并登录

```powershell
git clone --branch main https://github.com/wzlinbin/Customer-service-bot.git
cd Customer-service-bot
npm ci
npx wrangler login
npx wrangler whoami
```

### 2. 配置 Worker 和数据库

检查 `wrangler.jsonc`：

- `name`：Worker 名称，默认 `customer-service-bot`。
- `d1_databases[0].database_id`：当前账号下的 D1 数据库 ID。
- `vars.TELEGRAM_WEBHOOK_URL`：实际 Worker 地址加 `/telegram/webhook`。
- `vars.CHAT_ALLOWED_ORIGINS`：嵌入客服的网站 Origin，例如 `https://api.api2cn.com`。

现有部署继续使用原数据库。新账号首次部署时创建数据库，并将返回的 ID 填入 `database_id`，保留 `DB` 绑定名：

```powershell
npx wrangler d1 create customer-service-bot
```

### 3. 设置生产密钥

逐项运行，按提示输入值：

```powershell
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put TG_ADMIN_ID
npx wrangler secret put CHAT_API_KEY
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

分别为 Telegram Bot Token、接收消息的管理员 ID、网站代理与 Worker 共用的 API 密钥，以及 Telegram Webhook 的随机校验密钥。Webhook 密钥仅使用字母、数字、下划线和连字符。密钥不要写入源码；`.dev.vars` 仅用于本地开发。

### 4. 初始化并部署

```powershell
npm run cf:check
npm run cf:migrate:remote
npm run cf:deploy
```

部署会同时上传 Worker 和 `static/chat-widget.js`。Worker 会在收到已鉴权的聊天请求时自动配置 Telegram Webhook；管理员在 Telegram 中引用回复访客消息即可答复。

客服脚本 `/static/chat-widget.js` 和 `/api/chat/*` 需要 `X-API-Key`。网站应通过同源服务端代理加载脚本、转发 API 请求并添加密钥，浏览器中不放共享密钥。脚本的 `data-api-base` 指向网站代理路径。

## 日常更新

在项目目录运行：

```powershell
git switch main
git pull --ff-only origin main
npm ci
npm run cf:check
npm run cf:deploy
```

如果本次更新新增了 `migrations` 文件，部署前运行 `npm run cf:migrate:remote`。普通界面或文案更新无需数据库迁移，也无需重新设置密钥。

部署后在网站按 `Ctrl + F5` 强制刷新。Worker 脚本缓存为 5 分钟；如果网站代理另有缓存，需要同步清理。若脚本 URL 使用 `?v=...` 配合长期缓存，更新其版本参数。

排查运行问题时查看日志：

```powershell
npx wrangler tail
```

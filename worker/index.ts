const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const TELEGRAM_SESSION_PATTERN = /ID: ([A-Za-z0-9_-]+)/;
const encoder = new TextEncoder();

type Direction = "in" | "out";

interface ChatMessage {
  id: number;
  session_id: string;
  direction: Direction;
  content: string;
  is_read: number;
  created_at: string;
}

interface TelegramMessage {
  text?: string;
  caption?: string;
  chat?: { id?: number | string };
  reply_to_message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
  }
}

function intSetting(value: string, fallback: number, maximum?: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return maximum === undefined ? parsed : Math.min(parsed, maximum);
}

function validateSessionId(value: unknown, env: Env): string {
  const maximum = intSetting(env.CHAT_MAX_SESSION_ID_LENGTH, 100, 500);
  if (typeof value !== "string") throw new HttpError(400, "Invalid session_id");
  const result = value.trim();
  if (!result || result.length > maximum || !SESSION_ID_PATTERN.test(result)) {
    throw new HttpError(400, "Invalid session_id");
  }
  return result;
}

function validateText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string") throw new HttpError(400, `Invalid ${field}`);
  const result = value.trim();
  if (!result || result.length > maximum) {
    throw new HttpError(400, `Invalid ${field}`);
  }
  return result;
}

function escapeTelegramHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function secretsEqual(left: string, right: string): Promise<boolean> {
  const algorithm = { name: "HMAC", hash: "SHA-256" };
  const [leftKey, rightKey] = await Promise.all([
    crypto.subtle.importKey("raw", encoder.encode(`\0${left}`), algorithm, false, ["sign"]),
    crypto.subtle.importKey("raw", encoder.encode(`\0${right}`), algorithm, false, ["verify"]),
  ]);
  const challenge = encoder.encode("customer-service-bot-secret-check");
  const signature = await crypto.subtle.sign(algorithm, leftKey, challenge);
  return crypto.subtle.verify(algorithm, rightKey, signature, challenge);
}

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const exactOrigins = env.CHAT_ALLOWED_ORIGINS.split(",").map((item) => item.trim());
  if (exactOrigins.includes(origin)) return origin;
  try {
    return new RegExp(env.CHAT_ALLOWED_ORIGIN_REGEX, "i").test(origin) ? origin : null;
  } catch (error) {
    console.error(JSON.stringify({ event: "invalid_origin_regex", error: String(error) }));
    return null;
  }
}

function withCors(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.append("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function telegramEnabled(env: Env): boolean {
  return Boolean(env.TG_BOT_TOKEN && env.TG_ADMIN_ID);
}

async function telegramRequest(
  env: Env,
  method: "sendMessage" | "sendPhoto",
  body: FormData | Record<string, unknown>,
): Promise<void> {
  if (!telegramEnabled(env)) return;
  const response = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: "telegram_request_failed", method, status: response.status }));
    throw new Error(`Telegram ${method} returned ${response.status}`);
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureTelegramWebhook(env: Env): Promise<void> {
  const webhookUrl = env.TELEGRAM_WEBHOOK_URL.trim();
  if (!telegramEnabled(env) || !env.TELEGRAM_WEBHOOK_SECRET || !webhookUrl) {
    console.error(JSON.stringify({ event: "telegram_webhook_config_missing" }));
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    console.error(JSON.stringify({ event: "telegram_webhook_url_invalid" }));
    return;
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== "/telegram/webhook") {
    console.error(JSON.stringify({ event: "telegram_webhook_url_invalid" }));
    return;
  }

  const configHash = await sha256(`${webhookUrl}\0${env.TELEGRAM_WEBHOOK_SECRET}`);

  // Do not trust only our local marker. Telegram webhook state can be changed
  // externally (for example by an old deployment or a manual setWebhook call).
  // Checking the live state lets the hourly alarm repair delivery automatically.
  try {
    const infoResponse = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/getWebhookInfo`);
    const info = (await infoResponse.json()) as {
      ok?: boolean;
      result?: { url?: string; last_error_message?: string };
    };
    if (infoResponse.ok && info.ok && info.result?.url === webhookUrl && !info.result.last_error_message) {
      await env.DB.prepare(
        `INSERT INTO app_meta (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      ).bind("telegram_webhook_config_hash", configHash).run();
      return;
    }
    if (info.result?.last_error_message) {
      console.error(JSON.stringify({
        event: "telegram_webhook_unhealthy",
        error: info.result.last_error_message,
      }));
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "telegram_webhook_info_failed", error: String(error) }));
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const result = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !result.ok) {
    console.error(
      JSON.stringify({
        event: "telegram_webhook_setup_failed",
        status: response.status,
        description: result.description ?? "Unknown Telegram error",
      }),
    );
    throw new Error("Telegram webhook setup failed");
  }

  await env.DB.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = CURRENT_TIMESTAMP`,
  )
    .bind("telegram_webhook_config_hash", configHash)
    .run();
  console.log(JSON.stringify({ event: "telegram_webhook_configured", url: webhookUrl }));
}

function background(ctx: ExecutionContext, task: Promise<void>): void {
  ctx.waitUntil(
    task.catch((error) => {
      console.error(JSON.stringify({ event: "background_task_failed", error: String(error) }));
    }),
  );
}

async function readObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Invalid JSON body");
  }
  return value as Record<string, unknown>;
}

async function handleLogin(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await readObject(request);
  const sessionId = validateSessionId(body.session_id, env);
  const nickname = validateText(
    body.nickname,
    "nickname",
    intSetting(env.CHAT_MAX_NICKNAME_LENGTH, 50, 500),
  );
  await env.DB.prepare(
    `INSERT INTO chat_sessions (session_id, nickname, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(session_id) DO UPDATE SET
       nickname = excluded.nickname,
       created_at = CURRENT_TIMESTAMP`,
  )
    .bind(sessionId, nickname)
    .run();
  background(
    ctx,
    telegramRequest(env, "sendMessage", {
      chat_id: env.TG_ADMIN_ID,
      text: `<b>新客户接入</b>\n称呼: ${escapeTelegramHtml(nickname)}\nID: ${sessionId}`,
      parse_mode: "HTML",
    }),
  );
  return json({ success: true });
}

async function handleSend(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await readObject(request);
  const sessionId = validateSessionId(body.session_id, env);
  const content = validateText(
    body.content,
    "content",
    intSetting(env.CHAT_MAX_MESSAGE_LENGTH, 2000, 10000),
  );
  const session = await env.DB.prepare("SELECT nickname FROM chat_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<{ nickname: string }>();
  const nickname = session?.nickname ?? "未知用户";
  await env.DB.prepare(
    "INSERT INTO chat_msgs (session_id, direction, content) VALUES (?, 'in', ?)",
  )
    .bind(sessionId, content)
    .run();
  background(
    ctx,
    telegramRequest(env, "sendMessage", {
      chat_id: env.TG_ADMIN_ID,
      text:
        `<b>客户消息</b>\n称呼: ${escapeTelegramHtml(nickname)}\nID: ${sessionId}\n` +
        `------------------\n${escapeTelegramHtml(content)}\n------------------\n` +
        "<i>请回复此消息</i>",
      parse_mode: "HTML",
    }),
  );
  return json({ success: true });
}

async function handleUpload(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "Content-Type must be multipart/form-data");
  }
  const form = await request.formData();
  const sessionId = validateSessionId(form.get("session_id"), env);
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    throw new HttpError(400, "Only image uploads are allowed");
  }
  const maximum = intSetting(env.CHAT_MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
  if (file.size > maximum) throw new HttpError(413, "Image is too large");

  const session = await env.DB.prepare("SELECT nickname FROM chat_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<{ nickname: string }>();
  const nickname = session?.nickname ?? "未知用户";
  await env.DB.prepare(
    "INSERT INTO chat_msgs (session_id, direction, content) VALUES (?, 'in', ?)",
  )
    .bind(sessionId, "[发送了一张图片]")
    .run();

  const telegramForm = new FormData();
  telegramForm.set("chat_id", env.TG_ADMIN_ID);
  telegramForm.set(
    "caption",
    `<b>客户图片</b>\n称呼: ${escapeTelegramHtml(nickname)}\nID: ${sessionId}\n<i>请回复此图片</i>`,
  );
  telegramForm.set("parse_mode", "HTML");
  telegramForm.set("photo", file, file.name || "upload");
  background(ctx, telegramRequest(env, "sendPhoto", telegramForm));
  return json({ success: true });
}

async function handlePoll(url: URL, env: Env): Promise<Response> {
  const sessionId = validateSessionId(url.searchParams.get("session_id"), env);
  const limit = intSetting(env.CHAT_POLL_LIMIT, 50, 500);
  const result = await env.DB.prepare(
    `SELECT id, session_id, direction, content, is_read, created_at
     FROM (
       SELECT id, session_id, direction, content, is_read, created_at
       FROM chat_msgs WHERE session_id = ? ORDER BY id DESC LIMIT ?
     ) ORDER BY id ASC`,
  )
    .bind(sessionId, limit)
    .all<ChatMessage>();
  return json({ messages: result.results });
}

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return json({ detail: "Service unavailable" }, 503);
  const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!(await secretsEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET))) {
    return json({ detail: "Unauthorized" }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const message = update.message ?? update.edited_message;
  if (update.update_id === undefined) {
    console.log(JSON.stringify({ event: "telegram_update_ignored", reason: "missing_update_id" }));
    return json({ success: true });
  }
  if (!message?.text) {
    console.log(
      JSON.stringify({
        event: "telegram_update_ignored",
        reason: "not_a_text_message",
        update_id: update.update_id,
      }),
    );
    return json({ success: true });
  }
  if (!message.reply_to_message) {
    console.log(
      JSON.stringify({
        event: "telegram_update_ignored",
        reason: "not_a_reply",
        update_id: update.update_id,
      }),
    );
    return json({ success: true });
  }
  if (String(message.chat?.id) !== env.TG_ADMIN_ID) {
    console.log(
      JSON.stringify({
        event: "telegram_update_ignored",
        reason: "not_admin_chat",
        update_id: update.update_id,
      }),
    );
    return json({ success: true });
  }
  const original = message.reply_to_message.text ?? message.reply_to_message.caption ?? "";
  const match = TELEGRAM_SESSION_PATTERN.exec(original);
  if (!match) {
    console.log(
      JSON.stringify({
        event: "telegram_update_ignored",
        reason: "session_id_not_found",
        update_id: update.update_id,
      }),
    );
    return json({ success: true });
  }
  const sessionId = validateSessionId(match[1], env);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO chat_msgs
       (session_id, direction, content, telegram_update_id)
     VALUES (?, 'out', ?, ?)`,
  )
    .bind(sessionId, message.text, update.update_id)
    .run();
  console.log(
    JSON.stringify({ event: "telegram_reply_stored", update_id: update.update_id, session_id: sessionId }),
  );
  return json({ success: true });
}

async function authorizeChatRequest(request: Request, env: Env): Promise<Response | null> {
  if (!env.CHAT_API_KEY) return json({ detail: "Service unavailable" }, 503);
  const suppliedKey = request.headers.get("X-API-Key") ?? "";
  return (await secretsEqual(suppliedKey, env.CHAT_API_KEY))
    ? null
    : json({ detail: "Unauthorized" }, 401);
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const isChatApi = url.pathname === "/api/chat" || url.pathname.startsWith("/api/chat/");
  const isWidgetAsset = url.pathname.startsWith("/static/");
  const origin = allowedOrigin(request, env);

  if (request.method === "OPTIONS" && isChatApi) {
    if (request.headers.has("Origin") && !origin) return json({ detail: "Origin not allowed" }, 400);
    return withCors(
      new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
          "Access-Control-Max-Age": "86400",
        },
      }),
      origin,
    );
  }

  if (isChatApi || isWidgetAsset) {
    const unauthorized = await authorizeChatRequest(request, env);
    if (unauthorized) return withCors(unauthorized, origin);
    if (isChatApi) background(ctx, ensureTelegramWebhook(env));
  }

  let response: Response;
  if (request.method === "POST" && url.pathname === "/api/chat/login") {
    response = await handleLogin(request, env, ctx);
  } else if (request.method === "POST" && url.pathname === "/api/chat/send") {
    response = await handleSend(request, env, ctx);
  } else if (request.method === "POST" && url.pathname === "/api/chat/upload") {
    response = await handleUpload(request, env, ctx);
  } else if (request.method === "GET" && url.pathname === "/api/chat/poll") {
    response = await handlePoll(url, env);
  } else if (request.method === "POST" && url.pathname === "/telegram/webhook") {
    response = await handleTelegramWebhook(request, env);
  } else if (request.method === "GET" && isWidgetAsset) {
    const assetUrl = new URL(request.url);
    assetUrl.pathname = assetUrl.pathname.slice("/static".length);
    response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, max-age=300, must-revalidate");
    response = new Response(response.body, { status: response.status, headers });
  } else {
    response = json({ detail: "Not Found" }, 404);
  }
  return isChatApi ? withCors(response, origin) : response;
}

async function cleanupExpiredData(env: Env): Promise<void> {
  const retentionHours = intSetting(env.CHAT_DATA_RETENTION_HOURS, 24);
  const modifier = `-${retentionHours} hours`;
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM chat_msgs WHERE created_at < datetime('now', ?)").bind(modifier),
    env.DB.prepare(
      `DELETE FROM chat_sessions
       WHERE created_at < datetime('now', ?)
         AND NOT EXISTS (
           SELECT 1 FROM chat_msgs WHERE chat_msgs.session_id = chat_sessions.session_id
         )`,
    ).bind(modifier),
  ]);
  console.log(
    JSON.stringify({
      event: "expired_data_cleanup",
      deleted_messages: results[0].meta.changes,
      deleted_sessions: results[1].meta.changes,
    }),
  );
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      let response: Response;
      if (error instanceof HttpError) {
        response = json({ detail: error.detail }, error.status);
      } else {
        console.error(JSON.stringify({ event: "request_failed", error: String(error) }));
        response = json({ detail: "Internal server error" }, 500);
      }
      const path = new URL(request.url).pathname;
      const isChatApi = path === "/api/chat" || path.startsWith("/api/chat/");
      return isChatApi ? withCors(response, allowedOrigin(request, env)) : response;
    }
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(Promise.all([cleanupExpiredData(env), ensureTelegramWebhook(env)]).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;

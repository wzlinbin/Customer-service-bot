(function () {
    "use strict";

    if (document.getElementById("api2cn-chat-widget")) {
        return;
    }

    var script = document.currentScript;
    var apiBase = script && script.dataset.apiBase
        ? script.dataset.apiBase
        : new URL(script.src).origin;
    apiBase = apiBase.replace(/\/+$/, "");

    var storagePrefix = "api2cn_chat_";
    var sessionId = readStorage(storagePrefix + "sid");
    var nickname = readStorage(storagePrefix + "nickname");
    var knownMessageIds = new Set();
    var pollTimer = null;

    if (!sessionId) {
        sessionId = "u_" + (
            window.crypto && window.crypto.randomUUID
                ? window.crypto.randomUUID()
                : Date.now().toString(36) + Math.random().toString(36).slice(2)
        );
        writeStorage(storagePrefix + "sid", sessionId);
    }

    var host = document.createElement("div");
    host.id = "api2cn-chat-widget";
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: "open" });
    root.innerHTML = [
        "<style>",
        ":host{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#1f2937}",
        "*{box-sizing:border-box}",
        "button,input{font:inherit}",
        "button{border:0}",
        ".launcher{position:absolute;right:24px;bottom:24px;height:56px;padding:0 24px;border-radius:28px;background:#2867ed;color:#fff;display:flex;align-items:center;gap:11px;font-size:17px;font-weight:700;box-shadow:0 12px 28px rgba(40,103,237,.28);cursor:pointer;pointer-events:auto;transition:transform .18s,background .18s}",
        ".launcher:hover{transform:translateY(-2px);background:#1f5adb}",
        ".launcher:focus-visible,.close:focus-visible,.send:focus-visible,.upload:focus-within{outline:3px solid rgba(59,130,246,.35);outline-offset:2px}",
        ".chat-icon{width:24px;height:18px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;gap:2px;position:relative}",
        ".chat-icon:after{content:'';position:absolute;left:4px;bottom:-3px;border-width:3px 3px 0 0;border-style:solid;border-color:#fff transparent transparent transparent}",
        ".chat-icon i{width:3px;height:3px;border-radius:50%;background:#2867ed}",
        ".panel{position:absolute;right:24px;bottom:92px;width:360px;height:min(520px,calc(100vh - 116px));border:1px solid #e5e7eb;border-radius:8px;background:#fff;box-shadow:0 20px 48px rgba(15,23,42,.22);overflow:hidden;display:none;flex-direction:column;pointer-events:auto}",
        ".panel.open{display:flex}",
        ".header{height:78px;flex:0 0 78px;padding:15px 18px;background:#3271eb;color:#fff;display:flex;align-items:center;justify-content:space-between}",
        ".title{font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px}",
        ".dot{width:9px;height:9px;border-radius:50%;background:#46d68c}",
        ".status{margin-top:4px;font-size:12px;color:rgba(255,255,255,.82)}",
        ".close{width:36px;height:36px;background:transparent;color:#fff;font-size:30px;line-height:32px;cursor:pointer;border-radius:4px}",
        ".close:hover{background:rgba(255,255,255,.12)}",
        ".login{flex:1;padding:32px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc}",
        ".avatar{width:64px;height:64px;border-radius:50%;background:#fff;border:1px solid #edf0f5;box-shadow:0 3px 10px rgba(15,23,42,.08);display:grid;place-items:center;color:#3271eb;font-size:30px}",
        ".login h2{margin:22px 0 6px;font-size:20px}",
        ".login p{margin:0 0 22px;color:#98a2b3;font-size:14px;text-align:center}",
        ".name{width:100%;height:52px;border:1px solid #b9c3d4;border-radius:6px;background:#fff;padding:0 14px;color:#1f2937;outline:none}",
        ".name:focus{border-color:#3271eb;box-shadow:0 0 0 3px rgba(50,113,235,.12)}",
        ".start{width:100%;height:50px;margin-top:14px;border-radius:6px;background:#2867ed;color:#fff;font-weight:700;cursor:pointer}",
        ".start:hover{background:#1f5adb}",
        ".start:disabled,.send:disabled{opacity:.55;cursor:not-allowed}",
        ".messages-view{display:none;min-height:0;flex:1;flex-direction:column;background:#f6f7f9}",
        ".messages{min-height:0;flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}",
        ".bubble{max-width:85%;padding:11px 14px;border-radius:8px;font-size:15px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
        ".bubble.self{align-self:flex-end;background:#2867ed;color:#fff;border-top-right-radius:2px;box-shadow:0 4px 10px rgba(40,103,237,.18)}",
        ".bubble.other{align-self:flex-start;background:#fff;color:#344054;border:1px solid #e6e9ef;border-top-left-radius:2px}",
        ".composer{height:68px;flex:0 0 68px;padding:10px 14px;background:#fff;border-top:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}",
        ".upload{width:34px;height:34px;display:grid;place-items:center;color:#7b8798;font-size:20px;cursor:pointer;border-radius:4px}",
        ".upload:hover{background:#f2f4f7;color:#2867ed}",
        ".upload input{display:none}",
        ".message-input{min-width:0;flex:1;height:42px;border:0;border-radius:21px;background:#f1f3f6;padding:0 16px;outline:none}",
        ".message-input:focus{box-shadow:0 0 0 2px rgba(50,113,235,.18)}",
        ".send{height:38px;padding:0 4px;background:transparent;color:#2867ed;font-weight:700;cursor:pointer}",
        ".notice{display:none;padding:8px 14px;background:#fff3f2;color:#b42318;font-size:12px;border-bottom:1px solid #fecdca}",
        ".notice.show{display:block}",
        "@media(max-width:520px){.launcher{right:16px;bottom:16px}.panel{right:8px;bottom:80px;width:calc(100vw - 16px);height:calc(100vh - 96px)}}",
        "@media(prefers-reduced-motion:reduce){.launcher{transition:none}}",
        "</style>",
        "<button class='launcher' type='button' aria-expanded='false' aria-controls='api2cn-chat-panel'>",
        "<span class='chat-icon' aria-hidden='true'><i></i><i></i><i></i></span><span>在线客服</span>",
        "</button>",
        "<section class='panel' id='api2cn-chat-panel' aria-label='在线客服'>",
        "<header class='header'><div><div class='title'>客服支持 <span class='dot' aria-label='在线'></span></div><div class='status'>未连接</div></div><button class='close' type='button' aria-label='关闭客服窗口'>&times;</button></header>",
        "<div class='notice' role='alert'></div>",
        "<form class='login'><div class='avatar' aria-hidden='true'>☺</div><h2>欢迎咨询</h2><p>请设置一个称呼方便我们称呼您</p><input class='name' type='text' maxlength='50' autocomplete='name' placeholder='nickname' aria-label='您的称呼'><button class='start' type='submit'>开始对话</button></form>",
        "<div class='messages-view'><div class='messages' aria-live='polite'></div><form class='composer'><label class='upload' title='发送图片' aria-label='发送图片'>&#128206;<input type='file' accept='image/*'></label><input class='message-input' type='text' maxlength='2000' placeholder='输入消息...' aria-label='输入消息'><button class='send' type='submit'>发送</button></form></div>",
        "</section>"
    ].join("");

    var launcher = root.querySelector(".launcher");
    var panel = root.querySelector(".panel");
    var closeButton = root.querySelector(".close");
    var loginForm = root.querySelector(".login");
    var nameInput = root.querySelector(".name");
    var startButton = root.querySelector(".start");
    var messagesView = root.querySelector(".messages-view");
    var messages = root.querySelector(".messages");
    var composer = root.querySelector(".composer");
    var messageInput = root.querySelector(".message-input");
    var sendButton = root.querySelector(".send");
    var fileInput = root.querySelector(".upload input");
    var status = root.querySelector(".status");
    var notice = root.querySelector(".notice");

    launcher.addEventListener("click", function () {
        var willOpen = !panel.classList.contains("open");
        panel.classList.toggle("open", willOpen);
        launcher.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) {
            if (nickname) {
                showMessages();
                messageInput.focus();
            } else {
                nameInput.focus();
            }
        } else {
            stopPolling();
        }
    });

    closeButton.addEventListener("click", function () {
        panel.classList.remove("open");
        launcher.setAttribute("aria-expanded", "false");
        stopPolling();
        launcher.focus();
    });

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var name = nameInput.value.trim();
        if (!name) {
            nameInput.focus();
            return;
        }
        startButton.disabled = true;
        hideNotice();
        try {
            await request("/api/chat/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, nickname: name })
            });
            nickname = name;
            writeStorage(storagePrefix + "nickname", nickname);
            showMessages();
            messageInput.focus();
        } catch (error) {
            showNotice("连接客服失败，请稍后重试");
        } finally {
            startButton.disabled = false;
        }
    });

    composer.addEventListener("submit", async function (event) {
        event.preventDefault();
        var content = messageInput.value.trim();
        if (!content) {
            return;
        }
        sendButton.disabled = true;
        hideNotice();
        try {
            await request("/api/chat/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, content: content })
            });
            messageInput.value = "";
            await pollMessages();
        } catch (error) {
            showNotice("消息发送失败，请稍后重试");
        } finally {
            sendButton.disabled = false;
            messageInput.focus();
        }
    });

    fileInput.addEventListener("change", async function () {
        var file = fileInput.files[0];
        if (!file) {
            return;
        }
        hideNotice();
        var formData = new FormData();
        formData.append("session_id", sessionId);
        formData.append("file", file);
        try {
            await request("/api/chat/upload", {
                method: "POST",
                body: formData
            });
            await pollMessages();
        } catch (error) {
            showNotice("图片发送失败，请稍后重试");
        } finally {
            fileInput.value = "";
        }
    });

    function showMessages() {
        loginForm.style.display = "none";
        messagesView.style.display = "flex";
        status.textContent = nickname;
        startPolling();
    }

    function startPolling() {
        if (pollTimer) {
            return;
        }
        pollMessages();
        pollTimer = window.setInterval(pollMessages, 2000);
    }

    function stopPolling() {
        if (pollTimer) {
            window.clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    async function pollMessages() {
        try {
            var data = await request(
                "/api/chat/poll?session_id=" + encodeURIComponent(sessionId)
            );
            (data.messages || []).forEach(function (message) {
                if (!knownMessageIds.has(message.id)) {
                    knownMessageIds.add(message.id);
                    addBubble(
                        message.content,
                        message.direction === "in" ? "self" : "other"
                    );
                }
            });
        } catch (error) {
            showNotice("暂时无法获取客服消息");
        }
    }

    function addBubble(content, type) {
        var bubble = document.createElement("div");
        bubble.className = "bubble " + type;
        bubble.textContent = content;
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
    }

    async function request(path, options) {
        var response = await fetch(apiBase + path, options || {});
        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }
        var data = await response.json();
        if (data.success === false) {
            throw new Error(data.error || "Request failed");
        }
        hideNotice();
        return data;
    }

    function showNotice(message) {
        notice.textContent = message;
        notice.classList.add("show");
    }

    function hideNotice() {
        notice.classList.remove("show");
        notice.textContent = "";
    }

    function readStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            // The widget still works for the current page when storage is blocked.
        }
    }
})();

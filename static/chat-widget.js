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

    var translations = {
        en: {
            launcher: "Online support",
            closeLauncher: "Close online support",
            panelLabel: "Online support",
            supportTitle: "Customer support",
            online: "Online",
            disconnected: "Not connected",
            closeWindow: "Close support window",
            welcome: "Welcome",
            nicknamePrompt: "What should we call you?",
            nicknamePlaceholder: "Your name",
            nicknameLabel: "Your name",
            start: "Start chat",
            sendImage: "Send image",
            messagePlaceholder: "Type a message...",
            messageLabel: "Message",
            send: "Send",
            conversationGreeting: "Welcome to online customer support. Please enter your question or request, and a support agent will reply shortly. Please keep this window open during the conversation.",
            loginFailed: "Unable to connect. Please try again later.",
            sendFailed: "Message failed to send. Please try again.",
            uploadFailed: "Image failed to send. Please try again.",
            pollFailed: "Unable to retrieve support messages right now."
        },
        de: {
            launcher: "Online-Support",
            closeLauncher: "Online-Support schließen",
            panelLabel: "Online-Support",
            supportTitle: "Kundenservice",
            online: "Online",
            disconnected: "Nicht verbunden",
            closeWindow: "Supportfenster schließen",
            welcome: "Willkommen",
            nicknamePrompt: "Wie dürfen wir Sie ansprechen?",
            nicknamePlaceholder: "Ihr Name",
            nicknameLabel: "Ihr Name",
            start: "Chat starten",
            sendImage: "Bild senden",
            messagePlaceholder: "Nachricht eingeben...",
            messageLabel: "Nachricht",
            send: "Senden",
            conversationGreeting: "Willkommen beim Online-Kundenservice. Bitte geben Sie Ihre Frage oder Ihr Anliegen ein. Unser Kundenservice antwortet Ihnen in Kürze. Bitte schließen Sie dieses Fenster während des Gesprächs nicht.",
            loginFailed: "Verbindung fehlgeschlagen. Bitte versuchen Sie es später erneut.",
            sendFailed: "Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
            uploadFailed: "Bild konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
            pollFailed: "Supportnachrichten können derzeit nicht abgerufen werden."
        },
        es: {
            launcher: "Soporte en línea",
            closeLauncher: "Cerrar soporte en línea",
            panelLabel: "Soporte en línea",
            supportTitle: "Atención al cliente",
            online: "En línea",
            disconnected: "Sin conexión",
            closeWindow: "Cerrar ventana de soporte",
            welcome: "Bienvenido",
            nicknamePrompt: "¿Cómo podemos llamarte?",
            nicknamePlaceholder: "Tu nombre",
            nicknameLabel: "Tu nombre",
            start: "Iniciar chat",
            sendImage: "Enviar imagen",
            messagePlaceholder: "Escribe un mensaje...",
            messageLabel: "Mensaje",
            send: "Enviar",
            conversationGreeting: "Te damos la bienvenida al servicio de atención al cliente en línea. Escribe tu pregunta o solicitud; un agente te responderá en breve. No cierres esta ventana durante la conversación.",
            loginFailed: "No se pudo conectar. Inténtalo de nuevo más tarde.",
            sendFailed: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
            uploadFailed: "No se pudo enviar la imagen. Inténtalo de nuevo.",
            pollFailed: "No se pueden obtener los mensajes de soporte en este momento."
        },
        ja: {
            launcher: "オンラインサポート",
            closeLauncher: "オンラインサポートを閉じる",
            panelLabel: "オンラインサポート",
            supportTitle: "カスタマーサポート",
            online: "オンライン",
            disconnected: "未接続",
            closeWindow: "サポート画面を閉じる",
            welcome: "お問い合わせありがとうございます",
            nicknamePrompt: "お呼びするお名前を入力してください",
            nicknamePlaceholder: "お名前",
            nicknameLabel: "お名前",
            start: "チャットを開始",
            sendImage: "画像を送信",
            messagePlaceholder: "メッセージを入力...",
            messageLabel: "メッセージ",
            send: "送信",
            conversationGreeting: "オンラインカスタマーサポートへようこそ。ご質問やご要望を入力してください。後ほど担当者が回答します。会話中はこのウィンドウを閉じないでください。",
            loginFailed: "接続できませんでした。しばらくしてからもう一度お試しください。",
            sendFailed: "メッセージを送信できませんでした。もう一度お試しください。",
            uploadFailed: "画像を送信できませんでした。もう一度お試しください。",
            pollFailed: "現在、サポートからのメッセージを取得できません。"
        },
        "zh-CN": {
            launcher: "在线客服",
            closeLauncher: "关闭在线客服",
            panelLabel: "在线客服",
            supportTitle: "客服支持",
            online: "在线",
            disconnected: "未连接",
            closeWindow: "关闭客服窗口",
            welcome: "欢迎咨询",
            nicknamePrompt: "请设置一个称呼方便我们称呼您",
            nicknamePlaceholder: "您的称呼",
            nicknameLabel: "您的称呼",
            start: "开始对话",
            sendImage: "发送图片",
            messagePlaceholder: "输入消息...",
            messageLabel: "输入消息",
            send: "发送",
            conversationGreeting: "欢迎使用在线客服系统，请输入您的问题或请求，稍后客服会进行答复，对话期间请勿关闭窗口。",
            loginFailed: "连接客服失败，请稍后重试",
            sendFailed: "消息发送失败，请稍后重试",
            uploadFailed: "图片发送失败，请稍后重试",
            pollFailed: "暂时无法获取客服消息"
        },
        "zh-TW": {
            launcher: "線上客服",
            closeLauncher: "關閉線上客服",
            panelLabel: "線上客服",
            supportTitle: "客服支援",
            online: "線上",
            disconnected: "未連線",
            closeWindow: "關閉客服視窗",
            welcome: "歡迎諮詢",
            nicknamePrompt: "請設定稱呼，方便我們稱呼您",
            nicknamePlaceholder: "您的稱呼",
            nicknameLabel: "您的稱呼",
            start: "開始對話",
            sendImage: "傳送圖片",
            messagePlaceholder: "輸入訊息...",
            messageLabel: "輸入訊息",
            send: "傳送",
            conversationGreeting: "歡迎使用線上客服系統，請輸入您的問題或請求，稍後客服會進行答覆，對話期間請勿關閉視窗。",
            loginFailed: "連線客服失敗，請稍後再試",
            sendFailed: "訊息傳送失敗，請稍後再試",
            uploadFailed: "圖片傳送失敗，請稍後再試",
            pollFailed: "暫時無法取得客服訊息"
        }
    };
    var locale = resolveLocale(window.navigator.languages, window.navigator.language);

    function resolveLocale(preferredLanguages, browserLanguage) {
        var candidates = Array.isArray(preferredLanguages)
            ? preferredLanguages.slice()
            : [];
        if (!candidates.length && browserLanguage) {
            candidates.push(browserLanguage);
        }

        for (var index = 0; index < candidates.length; index += 1) {
            var language = String(candidates[index] || "")
                .replace(/_/g, "-")
                .toLowerCase();
            if (language === "zh" || language.indexOf("zh-") === 0) {
                if (/(^|-)(hant|cht|tw|hk|mo)(-|$)/.test(language)) {
                    return "zh-TW";
                }
                return "zh-CN";
            }

            var baseLanguage = language.split("-")[0];
            if (translations[baseLanguage]) {
                return baseLanguage;
            }
        }
        return "zh-CN";
    }

    function t(key) {
        return translations[locale][key] || translations["zh-CN"][key] || key;
    }

    var storagePrefix = "api2cn_chat_";
    clearLegacyStorage();
    var sessionId = readStorage(storagePrefix + "sid");
    var nickname = readStorage(storagePrefix + "nickname");
    var knownMessageIds = new Set();
    var pollTimer = null;
    var greetingShown = false;

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
        ".launcher-row{position:absolute;right:24px;bottom:24px;display:flex;align-items:center;gap:8px;pointer-events:auto}",
        ".launcher{height:56px;padding:0 24px;border-radius:28px;background:#2867ed;color:#fff;display:flex;align-items:center;gap:11px;font-size:17px;font-weight:700;box-shadow:0 12px 28px rgba(40,103,237,.28);cursor:pointer;transition:transform .18s,background .18s}",
        ".launcher:hover{transform:translateY(-2px);background:#1f5adb}",
        ".dismiss{width:32px;height:32px;flex:0 0 32px;border:1px solid #d9dee8;border-radius:50%;background:#fff;color:#667085;display:grid;place-items:center;font-size:22px;line-height:1;box-shadow:0 5px 16px rgba(15,23,42,.14);cursor:pointer}",
        ".dismiss:hover{background:#f5f7fa;color:#1f2937}",
        ".launcher:focus-visible,.dismiss:focus-visible,.close:focus-visible,.send:focus-visible,.upload:focus-within{outline:3px solid rgba(59,130,246,.35);outline-offset:2px}",
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
        "@media(max-width:520px){.launcher-row{right:16px;bottom:16px}.panel{right:8px;bottom:80px;width:calc(100vw - 16px);height:calc(100vh - 96px)}}",
        "@media(prefers-reduced-motion:reduce){.launcher{transition:none}}",
        "</style>",
        "<div class='launcher-row'><button class='launcher' type='button' aria-expanded='false' aria-controls='api2cn-chat-panel'>",
        "<span class='chat-icon' aria-hidden='true'><i></i><i></i><i></i></span><span data-i18n='launcher'>Online support</span>",
        "</button><button class='dismiss' type='button' data-i18n-title='closeLauncher' data-i18n-aria='closeLauncher' title='Close online support' aria-label='Close online support'>&times;</button></div>",
        "<section class='panel' id='api2cn-chat-panel' data-i18n-aria='panelLabel' aria-label='Online support'>",
        "<header class='header'><div><div class='title'><span data-i18n='supportTitle'>Customer support</span> <span class='dot' data-i18n-aria='online' aria-label='Online'></span></div><div class='status' data-i18n='disconnected'>Not connected</div></div><button class='close' type='button' data-i18n-aria='closeWindow' aria-label='Close support window'>&times;</button></header>",
        "<div class='notice' role='alert'></div>",
        "<form class='login'><div class='avatar' aria-hidden='true'>☺</div><h2 data-i18n='welcome'>Welcome</h2><p data-i18n='nicknamePrompt'>What should we call you?</p><input class='name' type='text' maxlength='50' autocomplete='name' data-i18n-placeholder='nicknamePlaceholder' data-i18n-aria='nicknameLabel' placeholder='Your name' aria-label='Your name'><button class='start' type='submit' data-i18n='start'>Start chat</button></form>",
        "<div class='messages-view'><div class='messages' aria-live='polite'></div><form class='composer'><label class='upload' data-i18n-title='sendImage' data-i18n-aria='sendImage' title='Send image' aria-label='Send image'>&#128206;<input type='file' accept='image/*'></label><input class='message-input' type='text' maxlength='2000' data-i18n-placeholder='messagePlaceholder' data-i18n-aria='messageLabel' placeholder='Type a message...' aria-label='Message'><button class='send' type='submit' data-i18n='send'>Send</button></form></div>",
        "</section>"
    ].join("");

    root.querySelector(".panel").setAttribute("lang", locale);
    root.querySelectorAll("[data-i18n]").forEach(function (element) {
        element.textContent = t(element.getAttribute("data-i18n"));
    });
    ["title", "aria", "placeholder"].forEach(function (attribute) {
        root.querySelectorAll("[data-i18n-" + attribute + "]").forEach(function (element) {
            var targetAttribute = attribute === "aria" ? "aria-label" : attribute;
            element.setAttribute(
                targetAttribute,
                t(element.getAttribute("data-i18n-" + attribute))
            );
        });
    });

    var launcher = root.querySelector(".launcher");
    var dismissButton = root.querySelector(".dismiss");
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

    dismissButton.addEventListener("click", function () {
        stopPolling();
        host.remove();
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
            showNotice(t("loginFailed"));
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
            showNotice(t("sendFailed"));
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
            showNotice(t("uploadFailed"));
        } finally {
            fileInput.value = "";
        }
    });

    function showMessages() {
        loginForm.style.display = "none";
        messagesView.style.display = "flex";
        status.textContent = nickname;
        if (!greetingShown) {
            addBubble(t("conversationGreeting"), "other");
            greetingShown = true;
        }
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
            showNotice(t("pollFailed"));
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
            return window.sessionStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.sessionStorage.setItem(key, value);
        } catch (error) {
            // The widget still works for the current page when storage is blocked.
        }
    }

    function clearLegacyStorage() {
        try {
            window.localStorage.removeItem(storagePrefix + "sid");
            window.localStorage.removeItem(storagePrefix + "nickname");
        } catch (error) {
            // Ignore browsers that block access to local storage.
        }
    }
})();

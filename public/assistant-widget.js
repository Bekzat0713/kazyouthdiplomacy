(function () {
  var STORAGE_PREFIX = "kyd_assistant_history_v1:";
  var MAX_MESSAGES = 10;
  var PAGE_LABELS = {
    dashboard: "Личный кабинет",
    internships: "Стажировки",
    opportunities: "Возможности",
    resources: "Материалы",
    subscribe: "Подписка",
  };
  var SUGGESTIONS = {
    dashboard: [
      "Что мне делать дальше по моему маршруту?",
      "Объясни мой текущий доступ",
      "На что мне податься в первую очередь?",
    ],
    internships: [
      "Подбери 3 стажировки под мой профиль",
      "Что здесь самое релевантное для госслужбы?",
      "Есть ли варианты без большого опыта?",
    ],
    opportunities: [
      "Покажи 3 самые полезные возможности для меня",
      "Есть ли здесь гранты или стипендии?",
      "С чего начать поиск по моей цели?",
    ],
    resources: [
      "Какие материалы мне открыть сначала?",
      "Нужны ресурсы по CV и интервью",
      "Что поможет мне быстрее подать заявку?",
    ],
    subscribe: [
      "Чем Free отличается от Plus именно для меня?",
      "У меня уже активен Plus?",
      "Что я получу после апгрейда?",
    ],
  };


  function injectStyles() {
    var css = "\
      /* Custom Premium Styles for AI Youth Assistant */\n\
      .site-assistant-panel {\n\
        font-family: 'DM Sans', sans-serif !important;\n\
        border: 1px solid rgba(93, 115, 255, 0.2) !important;\n\
      }\n\
      .site-assistant-message {\n\
        animation: assistant-message-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;\n\
        border-radius: 18px !important;\n\
        padding: 12px 14px !important;\n\
      }\n\
      .site-assistant-message-assistant {\n\
        background: rgba(255, 255, 255, 0.95) !important;\n\
        box-shadow: 0 4px 12px rgba(93, 115, 255, 0.04) !important;\n\
        border: 1px solid rgba(93, 115, 255, 0.1) !important;\n\
      }\n\
      .site-assistant-message-user {\n\
        background: linear-gradient(135deg, #5d73ff 0%, #7d4dff 100%) !important;\n\
        box-shadow: 0 4px 12px rgba(125, 77, 255, 0.15) !important;\n\
      }\n\
      .site-assistant-message-badge {\n\
        font-size: 0.65rem !important;\n\
        padding: 4px 8px !important;\n\
        font-family: 'Syne', sans-serif !important;\n\
      }\n\
      .site-assistant-message-text p {\n\
        margin: 0 0 8px 0;\n\
      }\n\
      .site-assistant-message-text p:last-child {\n\
        margin-bottom: 0;\n\
      }\n\
      .site-assistant-message-text ul {\n\
        margin: 4px 0 8px 0;\n\
        padding-left: 18px;\n\
      }\n\
      .site-assistant-message-text li {\n\
        margin-bottom: 4px;\n\
        list-style-type: disc;\n\
      }\n\
      .assistant-inline-link {\n\
        color: #5d73ff;\n\
        text-decoration: underline;\n\
        font-weight: 600;\n\
        transition: color 0.2s ease;\n\
      }\n\
      .site-assistant-message-user .assistant-inline-link {\n\
        color: #ffffff;\n\
      }\n\
      .assistant-inline-link:hover {\n\
        color: #7d4dff;\n\
      }\n\
      .site-assistant-message-user .assistant-inline-link:hover {\n\
        color: rgba(255, 255, 255, 0.85);\n\
      }\n\
      .site-assistant-typing-cursor {\n\
        display: inline-block;\n\
        width: 8px;\n\
        color: #5d73ff;\n\
        margin-left: 2px;\n\
        animation: assistant-cursor-blink 0.8s infinite steps(2, start);\n\
      }\n\
      .site-assistant-message-user .site-assistant-typing-cursor {\n\
        color: #ffffff;\n\
      }\n\
      .site-assistant-typing-dots {\n\
        display: inline-flex;\n\
        align-items: center;\n\
        gap: 6px;\n\
        padding: 8px 12px;\n\
      }\n\
      .site-assistant-typing-dots span {\n\
        width: 7px;\n\
        height: 7px;\n\
        border-radius: 50%;\n\
        background-color: #5d73ff;\n\
        animation: assistant-dot-pulse 1.4s infinite ease-in-out both;\n\
      }\n\
      .site-assistant-typing-dots span:nth-child(1) { animation-delay: -0.32s; }\n\
      .site-assistant-typing-dots span:nth-child(2) { animation-delay: -0.16s; }\n\
      \n\
      @keyframes assistant-message-slide {\n\
        from {\n\
          opacity: 0;\n\
          transform: translateY(16px);\n\
        }\n\
        to {\n\
          opacity: 1;\n\
          transform: translateY(0);\n\
        }\n\
      }\n\
      @keyframes assistant-cursor-blink {\n\
        to { opacity: 0; }\n\
      }\n\
      @keyframes assistant-dot-pulse {\n\
        0%, 80%, 100% { transform: scale(0.3); opacity: 0.4; }\n\
        40% { transform: scale(1.0); opacity: 1; }\n\
      }\n\
    ";
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function parseMarkdown(text) {
    if (!text) return "";
    var escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    var lines = escaped.split("\n");
    var result = [];
    var inList = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      
      if (line.indexOf("* ") === 0 || line.indexOf("- ") === 0) {
        if (!inList) {
          result.push("<ul>");
          inList = true;
        }
        var content = line.substring(2);
        content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        content = content.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="assistant-inline-link">$1</a>');
        result.push("<li>" + content + "</li>");
      } else {
        if (inList) {
          result.push("</ul>");
          inList = false;
        }
        if (line) {
          var formatted = line
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="assistant-inline-link">$1</a>');
          result.push("<p>" + formatted + "</p>");
        }
      }
    }
    if (inList) {
      result.push("</ul>");
    }
    return result.join("");
  }

  function stripMarkdown(text) {
    return String(text || "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
  }

  function detectPage() {
    var explicitPage = document.body && document.body.dataset
      ? document.body.dataset.assistantPage
      : "";

    if (explicitPage && PAGE_LABELS[explicitPage]) {
      return explicitPage;
    }

    var path = String(window.location.pathname || "").toLowerCase();
    if (path.indexOf("/internships") === 0) return "internships";
    if (path.indexOf("/opportunities") === 0) return "opportunities";
    if (path.indexOf("/resources") === 0) return "resources";
    if (path.indexOf("/subscribe") === 0) return "subscribe";
    return "dashboard";
  }

  function createNode(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (typeof text === "string") {
      node.textContent = text;
    }
    return node;
  }

  function getStorageKey(page) {
    return STORAGE_PREFIX + page;
  }

  function loadHistory(page) {
    try {
      var raw = sessionStorage.getItem(getStorageKey(page));
      if (!raw) {
        return [];
      }

      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(function (message) {
          return message
            && (message.role === "user" || message.role === "assistant")
            && typeof message.content === "string"
            && message.content.trim();
        })
        .slice(-MAX_MESSAGES);
    } catch (_error) {
      return [];
    }
  }

  function saveHistory(page, messages) {
    try {
      sessionStorage.setItem(
        getStorageKey(page),
        JSON.stringify(messages.slice(-MAX_MESSAGES))
      );
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function buildWelcomeMessage(page) {
    return {
      role: "assistant",
      content: "Я встроенный Youth-помощник раздела «" + (PAGE_LABELS[page] || "Кабинет") + "». Могу объяснить доступ, подсказать следующий шаг и помочь найти нужные возможности на платформе.",
      ephemeral: true,
    };
  }

  function renderMessages(state) {
    if (state.typingIntervals) {
      state.typingIntervals.forEach(window.clearInterval);
    }
    state.typingIntervals = [];

    state.messagesRoot.innerHTML = "";

    state.messages.forEach(function (message) {
      var item = createNode("article", "site-assistant-message site-assistant-message-" + message.role);
      var badge = createNode("span", "site-assistant-message-badge", message.role === "user" ? "Вы" : "AI");
      var text = createNode("div", "site-assistant-message-text");
      
      item.appendChild(badge);
      item.appendChild(text);
      state.messagesRoot.appendChild(item);

      if (message.role === "assistant" && message.animate) {
        var plainText = stripMarkdown(message.content);
        var currentLength = 0;
        
        var cursor = createNode("span", "site-assistant-typing-cursor", "▋");
        var textSpan = createNode("span", "", "");
        text.appendChild(textSpan);
        text.appendChild(cursor);
        
        var interval = window.setInterval(function () {
          currentLength += 3;
          if (currentLength >= plainText.length) {
            window.clearInterval(interval);
            message.animate = false;
            text.innerHTML = parseMarkdown(message.content);
          } else {
            textSpan.textContent = plainText.substring(0, currentLength);
          }
          state.messagesRoot.scrollTop = state.messagesRoot.scrollHeight;
        }, 12);
        
        state.typingIntervals.push(interval);
      } else {
        text.innerHTML = parseMarkdown(message.content);
      }
    });

    if (state.sending) {
      var loadingItem = createNode("article", "site-assistant-message site-assistant-message-assistant site-assistant-message-loading");
      var badge = createNode("span", "site-assistant-message-badge", "AI");
      var dots = createNode("div", "site-assistant-typing-dots");
      dots.innerHTML = "<span></span><span></span><span></span>";
      loadingItem.appendChild(badge);
      loadingItem.appendChild(dots);
      state.messagesRoot.appendChild(loadingItem);
    }

    if (!state.messages.length && !state.sending) {
      var empty = createNode("p", "site-assistant-empty", "Спросите про подбор стажировок, материалы, подписку или следующий карьерный шаг.");
      state.messagesRoot.appendChild(empty);
    }

    state.messagesRoot.scrollTop = state.messagesRoot.scrollHeight;
  }

  function renderSuggestions(state) {
    state.suggestionsRoot.innerHTML = "";

    var suggestions = SUGGESTIONS[state.page] || [];
    if (state.messages.length > 1) {
      state.suggestionsRoot.hidden = true;
      return;
    }

    suggestions.forEach(function (text) {
      var button = createNode("button", "site-assistant-suggestion", text);
      button.type = "button";
      button.addEventListener("click", function () {
        state.input.value = text;
        state.input.focus();
      });
      state.suggestionsRoot.appendChild(button);
    });

    state.suggestionsRoot.hidden = suggestions.length === 0;
  }

  function renderStatus(state, text, tone) {
    state.status.textContent = text || "";
    state.status.dataset.tone = tone || "";
  }

  function setSending(state, sending) {
    state.sending = sending;
    state.submit.disabled = sending || !state.enabled;
    state.input.disabled = sending || !state.enabled;
    state.panel.dataset.busy = sending ? "true" : "false";
    state.submit.textContent = sending ? "Думаю..." : "Отправить";
  }

  function pushMessage(state, role, content, animate) {
    state.messages.push({
      role: role,
      content: String(content || "").trim(),
      animate: !!animate,
    });
    state.messages = state.messages.slice(-MAX_MESSAGES);
    saveHistory(state.page, state.messages.filter(function (message) {
      return !message.ephemeral;
    }));
    renderMessages(state);
    renderSuggestions(state);
  }

  async function fetchAssistantStatus(state) {
    try {
      var response = await fetch("/api/assistant/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        if (response.status === 401) {
          state.enabled = false;
          state.submit.disabled = true;
          state.input.disabled = true;
          renderStatus(state, "Войдите или зарегистрируйтесь, чтобы открыть Youth-помощника.", "warning");
          return;
        }

        if (response.status === 503) {
          state.enabled = false;
          state.submit.disabled = true;
          state.input.disabled = true;
          renderStatus(state, "Youth-помощник подключён в интерфейс, но на сервере ещё не завершена настройка.", "warning");
          return;
        }

        state.enabled = false;
        state.submit.disabled = true;
        state.input.disabled = true;
        renderStatus(state, "Не удалось проверить состояние Youth-помощника.", "warning");
        return;
      }

      var payload = await response.json();
      state.enabled = Boolean(payload.enabled);
      state.submit.disabled = !state.enabled;
      state.input.disabled = !state.enabled;

      if (!state.enabled) {
        state.submit.disabled = true;
        state.input.disabled = true;
        renderStatus(state, "Youth-помощник подключён в интерфейс, но на сервере ещё не задан OPENAI_API_KEY.", "warning");
      }
    } catch (_error) {
      state.enabled = false;
      state.submit.disabled = true;
      state.input.disabled = true;
      renderStatus(state, "Youth-помощник временно недоступен.", "warning");
    }
  }

  async function submitAssistantPrompt(state, promptText) {
    if (!state.enabled || state.sending) {
      return;
    }

    var text = String(promptText || "").trim();
    if (!text) {
      return;
    }

    pushMessage(state, "user", text);
    state.input.value = "";
    renderStatus(state, "Формирую ответ...", "muted");
    setSending(state, true);

    try {
      var response = await fetch("/api/assistant", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          page: state.page,
          messages: state.messages.filter(function (message) {
            return (message.role === "user" || message.role === "assistant") && !message.ephemeral;
          }).slice(-MAX_MESSAGES),
        }),
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        pushMessage(
          state,
          "assistant",
          payload && payload.error
            ? payload.error
            : "Не получилось получить ответ от AI-помощника.",
          true
        );
        renderStatus(state, "", "");
        return;
      }

      pushMessage(
        state,
        "assistant",
        payload && payload.reply
          ? payload.reply
          : "Пока не удалось собрать содержательный ответ. Попробуйте уточнить запрос.",
        true
      );
      renderStatus(state, "", "");
    } catch (_error) {
      pushMessage(state, "assistant", "Сервис AI-помощника сейчас недоступен. Попробуйте ещё раз чуть позже.", true);
      renderStatus(state, "", "");
    } finally {
      setSending(state, false);
      state.input.focus();
    }
  }

  function mountAssistant() {
    injectStyles();
    var page = detectPage();
    var launcher = createNode("button", "site-assistant-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Открыть Youth-помощника");
    launcher.innerHTML = "<span>AI</span><strong>Youth-помощник</strong>";

    var panel = createNode("aside", "site-assistant-panel");
    panel.hidden = true;

    var header = createNode("div", "site-assistant-header");
    var titleWrap = createNode("div", "site-assistant-header-copy");
    titleWrap.appendChild(createNode("span", "site-assistant-kicker", "Career GPS AI"));
    titleWrap.appendChild(createNode("h2", "site-assistant-title", "Youth-помощник"));
    titleWrap.appendChild(createNode("p", "site-assistant-subtitle", "Подскажу по разделу «" + (PAGE_LABELS[page] || "Кабинет") + "», доступу, подборкам и следующему шагу."));
    var close = createNode("button", "site-assistant-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть Youth-помощника");
    header.appendChild(titleWrap);
    header.appendChild(close);

    var suggestions = createNode("div", "site-assistant-suggestions");
    var messages = createNode("div", "site-assistant-messages");
    var status = createNode("p", "site-assistant-status");

    var form = createNode("form", "site-assistant-form");
    var input = createNode("textarea", "site-assistant-input");
    input.rows = 3;
    input.placeholder = "Напишите вопрос...";
    input.maxLength = 2000;

    var submit = createNode("button", "site-assistant-submit", "Отправить");
    submit.type = "submit";

    form.appendChild(input);
    form.appendChild(submit);

    panel.appendChild(header);
    panel.appendChild(suggestions);
    panel.appendChild(messages);
    panel.appendChild(status);
    panel.appendChild(form);

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    var state = {
      page: page,
      enabled: false,
      sending: false,
      launcher: launcher,
      panel: panel,
      input: input,
      submit: submit,
      status: status,
      messagesRoot: messages,
      suggestionsRoot: suggestions,
      messages: loadHistory(page),
      typingIntervals: [],
    };

    if (!state.messages.length) {
      state.messages = [buildWelcomeMessage(page)];
    }

    renderMessages(state);
    renderSuggestions(state);
    void fetchAssistantStatus(state);

    launcher.addEventListener("click", function () {
      var nextOpen = panel.hidden;
      panel.hidden = !nextOpen;
      launcher.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      if (nextOpen) {
        input.focus();
      }
    });

    close.addEventListener("click", function () {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      void submitAssistantPrompt(state, input.value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void submitAssistantPrompt(state, input.value);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountAssistant();
  });
})();

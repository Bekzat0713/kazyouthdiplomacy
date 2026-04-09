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
    state.messagesRoot.innerHTML = "";

    state.messages.forEach(function (message) {
      var item = createNode("article", "site-assistant-message site-assistant-message-" + message.role);
      var badge = createNode("span", "site-assistant-message-badge", message.role === "user" ? "Вы" : "AI");
      var text = createNode("p", "site-assistant-message-text", message.content);
      item.appendChild(badge);
      item.appendChild(text);
      state.messagesRoot.appendChild(item);
    });

    if (!state.messages.length) {
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

  function pushMessage(state, role, content) {
    state.messages.push({
      role: role,
      content: String(content || "").trim(),
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
          renderStatus(state, "Сессия истекла. Обновите страницу или войдите снова, чтобы открыть Youth-помощника.", "warning");
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
            : "Не получилось получить ответ от AI-помощника."
        );
        renderStatus(state, "", "");
        return;
      }

      pushMessage(
        state,
        "assistant",
        payload && payload.reply
          ? payload.reply
          : "Пока не удалось собрать содержательный ответ. Попробуйте уточнить запрос."
      );
      renderStatus(state, "", "");
    } catch (_error) {
      pushMessage(state, "assistant", "Сервис AI-помощника сейчас недоступен. Попробуйте ещё раз чуть позже.");
      renderStatus(state, "", "");
    } finally {
      setSending(state, false);
      state.input.focus();
    }
  }

  function mountAssistant() {
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

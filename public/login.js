(function () {
  "use strict";

  var form = document.getElementById("loginForm");
  var submitButton = document.getElementById("loginSubmit");
  var emailInput = document.getElementById("emailInput");
  var errorBox = document.getElementById("authError");
  var authSocial = document.querySelector("[data-auth-social]");
  var authSocialDivider = document.querySelector("[data-auth-social-divider]");
  var runtime = window.KYD_RUNTIME;
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost && runtime ? runtime.getBackendBaseUrl() : window.location.origin;
  var params = new URLSearchParams(window.location.search);
  var nextPath = params.get("next") || "/dashboard";

  var messages = {
    credentials: "Неверный email или пароль.",
    "rate-limit": "Слишком много попыток. Подождите немного и попробуйте снова.",
    session: "Не удалось открыть сессию. Попробуйте войти ещё раз.",
    "oauth-config": "Вход через Google пока не настроен.",
    "oauth-denied": "Вход через Google был отменён.",
    "oauth-email": "Google не вернул подтверждённый email.",
    "oauth-callback": "Не получилось завершить вход через Google. Попробуйте ещё раз.",
    server: "Не удалось войти. Попробуйте ещё раз немного позже."
  };

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function setLoading(loading) {
    if (!submitButton) return;
    submitButton.disabled = loading;
    submitButton.textContent = loading ? "Входим…" : "Войти";
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortController === "undefined") {
      return fetch(url, options);
    }

    var controller = new AbortController();
    var timeoutId = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs || 10000);
    var requestOptions = Object.assign({}, options, { signal: controller.signal });

    return fetch(url, requestOptions).finally(function () {
      window.clearTimeout(timeoutId);
    });
  }

  function setupPasswordToggle() {
    document.querySelectorAll("[data-password-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var input = document.getElementById(button.getAttribute("data-password-toggle"));
        if (!input) return;
        var willShow = input.type === "password";
        input.type = willShow ? "text" : "password";
        button.textContent = willShow ? "Скрыть" : "Показать";
        button.setAttribute("aria-label", willShow ? "Скрыть пароль" : "Показать пароль");
      });
    });
  }

  function setupOAuthButtons() {
    if (!authSocial || !backendBase) return;

    fetch(backendBase + "/api/auth/providers", {
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("providers");
        return response.json();
      })
      .then(function (payload) {
        var google = (payload.providers || []).find(function (provider) {
          return provider.id === "google";
        });
        var button = authSocial.querySelector('[data-oauth-provider="google"]');
        if (!google || !button) return;
        button.href = backendBase + google.auth_url;
        authSocial.hidden = false;
        if (authSocialDivider) authSocialDivider.hidden = false;
      })
      .catch(function () {
        authSocial.hidden = true;
        if (authSocialDivider) authSocialDivider.hidden = true;
      });
  }

  if (mustUseBackendHost && backendBase && form) {
    form.action = backendBase + "/login";
  }

  if (params.get("email") && emailInput) {
    emailInput.value = params.get("email");
  }

  var queryError = params.get("error");
  if (queryError) showError(messages[queryError] || "Ошибка входа.");

  setupPasswordToggle();
  setupOAuthButtons();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideError();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (!backendBase) {
      showError("Не удалось подключиться к серверу.");
      return;
    }

    setLoading(true);

    try {
      var response = await fetchWithTimeout(backendBase + "/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
          next: nextPath
        })
      }, 10000);
      var payload = await response.json().catch(function () { return {}; });

      if (!response.ok) {
        if (payload.redirectTo) {
          window.location.assign(payload.redirectTo);
          return;
        }
        showError(payload.message || messages[payload.error] || payload.error || messages.server);
        return;
      }

      window.location.assign(payload.redirectTo || "/dashboard");
    } catch (err) {
      showError(
        err && err.name === "AbortError"
          ? "Сервер не отвечает. Обновите страницу и попробуйте ещё раз."
          : "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз."
      );
    } finally {
      setLoading(false);
    }
  });
})();

(function () {
  "use strict";

  var form = document.getElementById("registerForm");
  var submitButton = document.getElementById("registerSubmit");
  var errorBox = document.getElementById("authError");
  var passwordInput = document.getElementById("registerPassword");
  var authSocial = document.querySelector("[data-auth-social]");
  var authSocialDivider = document.querySelector("[data-auth-social-divider]");
  var runtime = window.KYD_RUNTIME;
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost && runtime ? runtime.getBackendBaseUrl() : window.location.origin;

  var messages = {
    invalid: "Введите имя, корректный email и пароль.",
    exists: "Аккаунт с таким email уже есть. Войдите или восстановите пароль.",
    "password-weak": "Пароль должен содержать минимум 10 символов, букву и цифру.",
    "rate-limit": "Слишком много попыток. Подождите немного и попробуйте снова.",
    server: "Не удалось создать аккаунт. Попробуйте ещё раз немного позже."
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
    submitButton.textContent = loading ? "Создаём аккаунт…" : "Создать аккаунт";
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

  function updatePasswordRules() {
    var value = passwordInput ? passwordInput.value : "";
    var states = {
      length: value.length >= 10,
      letter: /[A-Za-zА-Яа-я]/.test(value),
      digit: /\d/.test(value)
    };

    Object.keys(states).forEach(function (key) {
      var rule = document.querySelector('[data-password-rule="' + key + '"]');
      if (rule) rule.classList.toggle("is-valid", states[key]);
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
    form.action = backendBase + "/register";
  }

  setupPasswordToggle();
  setupOAuthButtons();

  if (passwordInput) {
    passwordInput.addEventListener("input", updatePasswordRules);
    updatePasswordRules();
  }

  var queryError = new URLSearchParams(window.location.search).get("error");
  if (queryError) showError(messages[queryError] || "Ошибка регистрации.");

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
      var response = await fetch(backendBase + "/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          firstName: form.elements.firstName.value.trim(),
          email: form.elements.email.value.trim(),
          password: form.elements.password.value
        })
      });
      var payload = await response.json().catch(function () { return {}; });

      if (!response.ok) {
        showError(payload.message || messages[payload.error] || payload.error || messages.server);
        return;
      }

      window.location.assign(payload.redirectTo || "/dashboard");
    } catch (err) {
      showError("Проверьте интернет-соединение и попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  });
})();

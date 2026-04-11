(function () {
  var form = document.getElementById("loginForm");
  var emailInput = document.getElementById("emailInput");
  var registerLink = document.getElementById("registerLink");
  var resendWrap = document.getElementById("resendWrap");
  var resendButton = document.getElementById("resendButton");
  var verifyCodeWrap = document.getElementById("verifyCodeWrap");
  var verifyCodeForm = document.getElementById("verifyCodeForm");
  var verifyCodeInput = document.getElementById("verifyCodeInput");
  var verifyCodeButton = document.getElementById("verifyCodeButton");
  var errorBox = document.getElementById("authError");
  var runtime = window.KYD_RUNTIME;
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost && runtime ? runtime.getBackendBaseUrl() : window.location.origin;
  var params = new URLSearchParams(window.location.search);
  var error = params.get("error");
  var notice = params.get("notice");
  var email = params.get("email");

  var messages = {
    invalid: "Введите корректный email и пароль.",
    credentials: "Неверный email или пароль.",
    unverified: "Почта ещё не подтверждена. Введите код из письма или отправьте его повторно.",
    "verify-rate": "Подождите немного перед повторной отправкой кода.",
    "verify-code-invalid": "Неверный код подтверждения. Проверьте цифры и попробуйте снова.",
    "verify-code-expired": "Срок действия кода закончился. Запросите новый код.",
    "rate-limit": "Слишком много попыток. Подождите немного и попробуйте снова.",
    session: "Ошибка сессии. Попробуйте снова.",
    server: "Ошибка сервера или базы данных. Проверьте логи терминала."
  };

  var notices = {
    "verify-code-sent": "Аккаунт создан. Мы отправили 6-значный код на вашу почту.",
    "verify-code-resent": "Код отправлен повторно. Проверьте входящие и папку Спам.",
    "verify-code-preview": "SMTP пока не настроен на этом сервере. Обратитесь к администратору.",
    "verify-code-error": "Аккаунт создан, но код не ушёл. Можно отправить его повторно ниже.",
    "already-verified": "Почта уже подтверждена. Можно входить.",
    "password-reset-success": "Пароль обновлён. Теперь можно войти с новым паролем."
  };

  function setMessage(text, tone) {
    if (!errorBox) {
      return;
    }

    if (!text) {
      errorBox.textContent = "";
      errorBox.style.display = "none";
      return;
    }

    errorBox.textContent = text;
    errorBox.style.display = "block";
    errorBox.style.color = tone === "success" ? "#166534" : "#b42318";
  }

  function ensureBackendBase() {
    if (!mustUseBackendHost || backendBase) {
      return true;
    }

    setMessage(
      "Для запуска этой страницы из файла укажите адрес сервера через ?backendBase=... или откройте сайт через работающий backend.",
      "error"
    );
    return false;
  }

  function shouldShowVerificationUi() {
    return (
      error === "unverified" ||
      error === "verify-rate" ||
      error === "verify-code-invalid" ||
      error === "verify-code-expired" ||
      notice === "verify-code-sent" ||
      notice === "verify-code-resent" ||
      notice === "verify-code-preview" ||
      notice === "verify-code-error"
    );
  }

  function syncEmailIntoVerifyForm() {
    if (!emailInput || !verifyCodeForm) {
      return;
    }

    var hiddenEmail = verifyCodeForm.querySelector('input[name="email"]');
    if (!hiddenEmail) {
      hiddenEmail = document.createElement("input");
      hiddenEmail.type = "hidden";
      hiddenEmail.name = "email";
      verifyCodeForm.appendChild(hiddenEmail);
    }

    hiddenEmail.value = emailInput.value.trim();
  }

  if (mustUseBackendHost && backendBase) {
    if (form) {
      form.action = backendBase + "/login";
    }
    if (verifyCodeForm) {
      verifyCodeForm.action = backendBase + "/verify-email-code";
    }
    if (registerLink) {
      registerLink.href = backendBase + "/register-survey";
    }
  }

  if (email && emailInput) {
    emailInput.value = email;
  }

  syncEmailIntoVerifyForm();

  if (emailInput) {
    emailInput.addEventListener("input", syncEmailIntoVerifyForm);
    emailInput.addEventListener("change", syncEmailIntoVerifyForm);
  }

  if (error || notice) {
    setMessage(messages[error] || notices[notice] || "Ошибка входа.", error ? "error" : "success");
  }

  if (shouldShowVerificationUi()) {
    if (resendWrap) {
      resendWrap.style.display = "block";
    }
    if (verifyCodeWrap) {
      verifyCodeWrap.style.display = "block";
    }
  }

  if (resendButton) {
    resendButton.addEventListener("click", function () {
      var currentEmail = emailInput ? emailInput.value.trim() : "";

      if (!currentEmail) {
        setMessage("Сначала введите email.", "error");
        return;
      }

      if (!ensureBackendBase()) {
        return;
      }

      resendButton.disabled = true;
      resendButton.textContent = "Отправка...";
      syncEmailIntoVerifyForm();

      fetch(backendBase + "/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ email: currentEmail })
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(payload.error || "Не удалось отправить код.");
            }
            return payload;
          });
        })
        .then(function (payload) {
          if (verifyCodeWrap) {
            verifyCodeWrap.style.display = "block";
          }
          setMessage(payload.message || "Код отправлен.", "success");
          if (verifyCodeInput) {
            verifyCodeInput.focus();
          }
        })
        .catch(function (err) {
          setMessage(err.message || "Не удалось отправить код.", "error");
        })
        .finally(function () {
          resendButton.disabled = false;
          resendButton.textContent = "Отправить код ещё раз";
        });
    });
  }

  if (verifyCodeForm) {
    verifyCodeForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var currentEmail = emailInput ? emailInput.value.trim() : "";
      var currentCode = verifyCodeInput ? verifyCodeInput.value.trim() : "";

      if (!currentEmail) {
        setMessage("Сначала введите email.", "error");
        return;
      }

      if (!/^\d{6}$/.test(currentCode)) {
        setMessage("Введите 6-значный код подтверждения.", "error");
        return;
      }

      if (!ensureBackendBase()) {
        return;
      }

      syncEmailIntoVerifyForm();
      verifyCodeButton.disabled = true;
      verifyCodeButton.textContent = "Проверяем...";

      fetch(backendBase + "/verify-email-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          email: currentEmail,
          code: currentCode
        })
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) {
              throw new Error(payload.error || "Не удалось подтвердить код.");
            }
            return payload;
          });
        })
        .then(function (payload) {
          setMessage("Почта подтверждена. Перенаправляем в кабинет...", "success");
          window.location.href = payload.redirectTo || "/dashboard";
        })
        .catch(function (err) {
          setMessage(err.message || "Не удалось подтвердить код.", "error");
        })
        .finally(function () {
          verifyCodeButton.disabled = false;
          verifyCodeButton.textContent = "Подтвердить почту";
        });
    });
  }
})();

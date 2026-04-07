(function () {
  var form = document.getElementById("loginForm");
  var emailInput = document.getElementById("emailInput");
  var registerLink = document.getElementById("registerLink");
  var resendWrap = document.getElementById("resendWrap");
  var resendButton = document.getElementById("resendButton");
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost ? "http://localhost:3000" : window.location.origin;

  if (mustUseBackendHost) {
    form.action = backendBase + "/login";
    if (registerLink) registerLink.href = backendBase + "/register";
  }

  var errorBox = document.getElementById("authError");
  var params = new URLSearchParams(window.location.search);
  var error = params.get("error");
  var notice = params.get("notice");
  var email = params.get("email");

  var messages = {
    invalid: "Введите корректный email и пароль.",
    credentials: "Неверный email или пароль.",
    unverified: "Почта ещё не подтверждена. Откройте письмо или отправьте его повторно.",
    "verify-rate": "Подождите немного перед повторной отправкой письма.",
    "rate-limit": "Слишком много попыток. Подождите немного и попробуйте снова.",
    session: "Ошибка сессии. Попробуйте снова.",
    server: "Ошибка сервера или базы данных. Проверьте логи терминала."
  };

  var notices = {
    "verify-email": "Аккаунт создан. Проверьте почту и подтвердите email по ссылке из письма.",
    "verify-resent": "Письмо отправлено повторно. Проверьте входящие и папку Спам.",
    "verify-email-preview": "SMTP пока не настроен на этом сервере. Обратитесь к администратору.",
    "verify-email-error": "Аккаунт создан, но письмо не ушло. Можно отправить его повторно ниже.",
    "already-verified": "Почта уже подтверждена. Можно входить.",
    "password-reset-success": "Пароль обновлён. Теперь можно войти с новым паролем."
  };

  if (email && emailInput) {
    emailInput.value = email;
  }

  var shouldShowResend =
    error === "unverified" ||
    error === "verify-rate" ||
    notice === "verify-email" ||
    notice === "verify-resent" ||
    notice === "verify-email-preview" ||
    notice === "verify-email-error";

  if ((error || notice) && errorBox) {
    errorBox.textContent = messages[error] || notices[notice] || "Ошибка входа.";
    errorBox.style.display = "block";
    errorBox.style.color = error ? "#fca5a5" : "#a7f3d0";
  }

  if (shouldShowResend && resendWrap) {
    resendWrap.style.display = "block";
  }

  if (!resendButton) {
    return;
  }

  resendButton.addEventListener("click", function () {
    var currentEmail = emailInput ? emailInput.value.trim() : "";

    if (!currentEmail) {
      if (errorBox) {
        errorBox.textContent = "Сначала введите email.";
        errorBox.style.display = "block";
      }
      return;
    }

    resendButton.disabled = true;
    resendButton.textContent = "Отправка...";

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
            throw new Error(payload.error || "Не удалось отправить письмо.");
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (errorBox) {
          errorBox.textContent = payload.message || "Письмо отправлено.";
          errorBox.style.display = "block";
          errorBox.style.color = "#a7f3d0";
        }
      })
      .catch(function (err) {
        if (errorBox) {
          errorBox.textContent = err.message || "Не удалось отправить письмо.";
          errorBox.style.display = "block";
          errorBox.style.color = "#fca5a5";
        }
      })
      .finally(function () {
        resendButton.disabled = false;
        resendButton.textContent = "Отправить письмо ещё раз";
      });
  });
})();

(function () {
  var form = document.getElementById("forgotPasswordForm");
  var emailInput = document.getElementById("forgotEmailInput");
  var messageBox = document.getElementById("forgotPasswordMessage");
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost ? "http://localhost:3000" : window.location.origin;
  var params = new URLSearchParams(window.location.search);
  var notice = params.get("notice");
  var error = params.get("error");
  var email = params.get("email");

  if (mustUseBackendHost) {
    form.action = backendBase + "/forgot-password";
  }

  if (email && emailInput) {
    emailInput.value = email;
  }

  var notices = {
    "reset-sent": "Если аккаунт существует, ссылка для сброса уже отправлена на почту.",
    "reset-preview": "SMTP пока не настроен на этом сервере. Обратитесь к администратору."
  };

  var errors = {
    invalid: "Укажите email для сброса пароля.",
    "rate-limit": "Слишком много запросов на сброс пароля. Попробуйте позже.",
    server: "Не удалось отправить письмо для сброса пароля.",
    "reset-invalid": "Ссылка для сброса недействительна. Запросите новую.",
    "reset-expired": "Ссылка для сброса истекла. Запросите новую.",
    "reset-used": "Эта ссылка уже использована. Запросите новую."
  };

  var text = errors[error] || notices[notice] || "";
  if (text && messageBox) {
    messageBox.textContent = text;
    messageBox.style.display = "block";
    messageBox.style.color = error ? "#fca5a5" : "#a7f3d0";
  }
})();

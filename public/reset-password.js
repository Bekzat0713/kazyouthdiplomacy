(function () {
  var form = document.getElementById("resetPasswordForm");
  var tokenInput = document.getElementById("resetTokenInput");
  var messageBox = document.getElementById("resetPasswordMessage");
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost ? "http://localhost:3000" : window.location.origin;
  var params = new URLSearchParams(window.location.search);
  var token = params.get("token");
  var error = params.get("error");

  if (mustUseBackendHost) {
    form.action = backendBase + "/reset-password";
  }

  if (tokenInput) {
    tokenInput.value = token || "";
  }

  var messages = {
    invalid: "Введите новый пароль и его подтверждение.",
    "password-match": "Пароли должны совпадать.",
    "password-weak": "Пароль должен быть не короче 10 символов и содержать буквы и цифры.",
    server: "Не удалось обновить пароль. Попробуйте ещё раз немного позже."
  };

  if (error && messageBox) {
    messageBox.textContent = messages[error] || "Не удалось обновить пароль.";
    messageBox.style.display = "block";
  }

  form.addEventListener("submit", function (event) {
    var passwordField = form.elements.password;
    var confirmPasswordField = form.elements.confirmPassword;

    if (!tokenInput.value) {
      event.preventDefault();
      if (messageBox) {
        messageBox.textContent = "Ссылка для сброса неполная. Запросите новую.";
        messageBox.style.display = "block";
      }
      return;
    }

    if (passwordField && confirmPasswordField && passwordField.value !== confirmPasswordField.value) {
      event.preventDefault();
      if (messageBox) {
        messageBox.textContent = messages["password-match"];
        messageBox.style.display = "block";
      }
    }
  });
})();

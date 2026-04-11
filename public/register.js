(function () {
  var form = document.getElementById("registerForm");
  var loginLink = document.getElementById("loginLink");
  var birthDateInput = document.getElementById("birthDateInput");
  var universityInput = document.getElementById("universityInput");
  var universitiesDatalist = document.getElementById("kazakhstanUniversities");
  var runtime = window.KYD_RUNTIME;
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost && runtime ? runtime.getBackendBaseUrl() : window.location.origin;

  if (mustUseBackendHost && backendBase) {
    form.action = backendBase + "/register";
    if (loginLink) loginLink.href = backendBase + "/login";
  }

  if (birthDateInput) {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    birthDateInput.max = yyyy + "-" + mm + "-" + dd;
  }

  if (universitiesDatalist && Array.isArray(window.KAZAKHSTAN_UNIVERSITIES)) {
    window.KAZAKHSTAN_UNIVERSITIES.forEach(function (universityName) {
      var option = document.createElement("option");
      option.value = universityName;
      universitiesDatalist.appendChild(option);
    });
  }

  var errorBox = document.getElementById("authError");
  var error = new URLSearchParams(window.location.search).get("error");

  var messages = {
    invalid: "Проверьте все поля: имя, фамилию, дату рождения, вуз, место работы, email и пароль.",
    exists: "Пользователь с таким email уже существует.",
    "password-weak": "Пароль должен быть не короче 10 символов и содержать буквы и цифры.",
    "password-match": "Пароль и повтор пароля должны совпадать.",
    "rate-limit": "Слишком много попыток регистрации. Подождите немного и попробуйте снова.",
    server: "Ошибка сервера или базы данных. Проверьте логи терминала."
  };

  form.addEventListener("submit", function (event) {
    var passwordField = form.elements.password;
    var confirmPasswordField = form.elements.confirmPassword;

    if (passwordField && confirmPasswordField && passwordField.value !== confirmPasswordField.value) {
      event.preventDefault();
      if (errorBox) {
        errorBox.textContent = messages["password-match"];
        errorBox.style.display = "block";
      }
      return;
    }

    if (universityInput && !universityInput.value.trim()) {
      event.preventDefault();
      if (errorBox) {
        errorBox.textContent = "Укажите учебное заведение.";
        errorBox.style.display = "block";
      }
    }
  });

  if (error && errorBox) {
    errorBox.textContent = messages[error] || "Ошибка регистрации.";
    errorBox.style.display = "block";
  }
})();

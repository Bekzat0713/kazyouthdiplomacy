(function () {
  var form = document.getElementById("preRegisterSurveyForm");
  var submitBtn = document.getElementById("surveySubmitBtn");
  var nextBtn = document.getElementById("surveyNextBtn");
  var prevBtn = document.getElementById("surveyPrevBtn");
  var errorBox = document.getElementById("surveyError");
  var stepLabel = document.getElementById("surveyStepLabel");
  var progressFill = document.getElementById("surveyProgressFill");
  var steps = Array.prototype.slice.call(form.querySelectorAll(".survey-step"));
  var currentStep = 0;

  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost ? "http://localhost:3000" : window.location.origin;
  var apiUrl = mustUseBackendHost
    ? backendBase + "/api/register-survey"
    : "/api/register-survey";
  var registerUrl = mustUseBackendHost
    ? backendBase + "/register"
    : "/register";

  function getRadioValue(name) {
    var selected = form.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : "";
  }

  function getCheckedValues(name) {
    return Array.prototype.slice.call(
      form.querySelectorAll('input[name="' + name + '"]:checked')
    ).map(function (input) {
      return input.value;
    });
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  function isStepAnswered(stepIndex) {
    var step = steps[stepIndex];
    if (!step) return false;

    var fieldName = step.dataset.field;
    var kind = step.dataset.kind || "radio";
    if (!fieldName) return true;

    if (kind === "checkbox") {
      return form.querySelectorAll('input[name="' + fieldName + '"]:checked').length > 0;
    }

    return Boolean(form.querySelector('input[name="' + fieldName + '"]:checked'));
  }

  function goToStep(stepIndex) {
    currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));

    steps.forEach(function (step, index) {
      step.hidden = index !== currentStep;
    });

    prevBtn.hidden = currentStep === 0;
    nextBtn.hidden = currentStep === steps.length - 1;
    submitBtn.hidden = currentStep !== steps.length - 1;

    stepLabel.textContent = "Шаг " + (currentStep + 1);
    progressFill.style.width = ((currentStep + 1) / steps.length) * 100 + "%";
  }

  function validatePayload(payload) {
    if (!payload.current_status || !payload.age_group || !payload.main_goal) return false;
    if (!payload.goal_clarity || !payload.main_blocker || !payload.current_experience) return false;
    if (!payload.english_level || !payload.needs_action_plan) return false;
    if (!Array.isArray(payload.discovery_channels) || payload.discovery_channels.length === 0) return false;
    return true;
  }

  function findFirstIncompleteStep() {
    for (var i = 0; i < steps.length; i += 1) {
      if (!isStepAnswered(i)) {
        return i;
      }
    }
    return -1;
  }

  nextBtn.addEventListener("click", function () {
    if (!isStepAnswered(currentStep)) {
      showError("Выберите вариант ответа, чтобы продолжить.");
      return;
    }

    hideError();
    goToStep(currentStep + 1);
  });

  prevBtn.addEventListener("click", function () {
    hideError();
    goToStep(currentStep - 1);
  });

  form.addEventListener("change", function (event) {
    var input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!steps[currentStep].contains(input)) return;

    hideError();

    // Радио-вопросы переключаются мягко на следующий шаг.
    if (steps[currentStep].dataset.kind === "radio" && input.type === "radio" && currentStep < steps.length - 1) {
      var stepAtChange = currentStep;
      window.setTimeout(function () {
        if (currentStep === stepAtChange) {
          goToStep(stepAtChange + 1);
        }
      }, 120);
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideError();

    if (!isStepAnswered(currentStep)) {
      showError("Выберите вариант ответа, чтобы продолжить.");
      return;
    }

    var firstIncompleteStep = findFirstIncompleteStep();
    if (firstIncompleteStep !== -1) {
      goToStep(firstIncompleteStep);
      if (steps[firstIncompleteStep].dataset.kind === "checkbox") {
        showError("Выберите хотя бы один вариант, чтобы продолжить.");
      } else {
        showError("Выберите вариант ответа, чтобы продолжить.");
      }
      return;
    }

    var payload = {
      current_status: getRadioValue("current_status"),
      age_group: getRadioValue("age_group"),
      main_goal: getRadioValue("main_goal"),
      goal_clarity: getRadioValue("goal_clarity"),
      main_blocker: getRadioValue("main_blocker"),
      current_experience: getRadioValue("current_experience"),
      english_level: getRadioValue("english_level"),
      discovery_channels: getCheckedValues("discovery_channels"),
      needs_action_plan: getRadioValue("needs_action_plan")
    };

    if (!validatePayload(payload)) {
      showError("Пожалуйста, ответьте на все вопросы перед отправкой.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Сохраняем...";

    try {
      var response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      var result = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        showError(result.error || "Не удалось отправить опрос. Попробуйте еще раз.");
        return;
      }

      window.location.href = result.redirect || registerUrl;
    } catch (err) {
      showError("Проблема с сетью или сервером. Попробуйте еще раз.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Отправить и продолжить";
    }
  });

  var errorCode = new URLSearchParams(window.location.search).get("error");
  if (errorCode === "required") {
    showError("Сначала заполните опрос, затем откроется регистрация.");
  }

  goToStep(0);
})();

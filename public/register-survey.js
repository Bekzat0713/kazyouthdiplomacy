(function () {
  "use strict";

  var form = document.getElementById("preRegisterSurveyForm");
  var submitBtn = document.getElementById("surveySubmitBtn");
  var nextBtn = document.getElementById("surveyNextBtn");
  var prevBtn = document.getElementById("surveyPrevBtn");
  var errorBox = document.getElementById("surveyError");
  var stepLabel = document.getElementById("surveyStepLabel");
  var progressFill = document.getElementById("surveyProgressFill");
  var steps = Array.prototype.slice.call(form.querySelectorAll(".survey-step"));
  var currentStep = 0;
  var runtime = window.KYD_RUNTIME;
  var mustUseBackendHost = window.location.protocol === "file:";
  var backendBase = mustUseBackendHost && runtime ? runtime.getBackendBaseUrl() : window.location.origin;
  var apiUrl = backendBase + "/api/register-survey";

  function getRadioValue(name) {
    var selected = form.querySelector('input[name="' + name + '"]:checked');
    return selected ? selected.value : "";
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function isStepAnswered(stepIndex) {
    var step = steps[stepIndex];
    if (!step) return false;
    return Boolean(form.querySelector('input[name="' + step.dataset.field + '"]:checked'));
  }

  function goToStep(stepIndex) {
    currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
    steps.forEach(function (step, index) {
      step.hidden = index !== currentStep;
    });
    prevBtn.hidden = currentStep === 0;
    nextBtn.hidden = currentStep === steps.length - 1;
    submitBtn.hidden = currentStep !== steps.length - 1;
    stepLabel.textContent = "Вопрос " + (currentStep + 1) + " из " + steps.length;
    progressFill.style.width = ((currentStep + 1) / steps.length) * 100 + "%";
  }

  nextBtn.addEventListener("click", function () {
    if (!isStepAnswered(currentStep)) {
      showError("Выберите вариант ответа.");
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
    if (!(event.target instanceof HTMLInputElement)) return;
    hideError();
    if (currentStep < steps.length - 1) {
      var stepAtChange = currentStep;
      window.setTimeout(function () {
        if (currentStep === stepAtChange) goToStep(stepAtChange + 1);
      }, 160);
    }
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    hideError();

    if (!isStepAnswered(currentStep)) {
      showError("Выберите вариант ответа.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Сохраняем…";

    try {
      var response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          current_status: getRadioValue("current_status"),
          main_goal: getRadioValue("main_goal"),
          english_level: getRadioValue("english_level")
        })
      });
      var result = await response.json().catch(function () { return {}; });

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) {
        showError(result.error || "Не удалось сохранить ответы. Попробуйте ещё раз.");
        return;
      }

      window.location.assign(result.redirect || "/dashboard");
    } catch (err) {
      showError("Проверьте интернет-соединение и попробуйте ещё раз.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Сохранить и открыть кабинет";
    }
  });

  goToStep(0);
})();

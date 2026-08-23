(function () {
  "use strict";

  var loading = document.getElementById("roleExperienceLoading");
  var app = document.getElementById("roleExperienceApp");
  var catalog = document.getElementById("roleExperienceCatalog");
  var runner = document.getElementById("roleExperienceRunner");
  var experience = null;
  var progress = null;
  var currentTaskIndex = 0;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function api(url, options) {
    var response = await fetch(url, Object.assign({ credentials: "include" }, options || {}));
    if (response.status === 401) {
      window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
      throw new Error("Unauthorized");
    }
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || "Не удалось выполнить запрос");
    return payload;
  }

  function trackEvent(eventType, slug) {
    if (!slug) return;
    fetch("/api/role-experiences/" + encodeURIComponent(slug) + "/track", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType }),
    }).catch(function () {});
  }

  function showApp() {
    if (loading) loading.hidden = true;
    if (app) app.hidden = false;
  }

  function showFatal(message) {
    if (!loading) return;
    loading.innerHTML = "";
    var title = document.createElement("strong");
    var text = document.createElement("p");
    title.textContent = "Role Experience временно недоступен";
    text.textContent = message || "Обновите страницу и попробуйте снова.";
    loading.appendChild(title);
    loading.appendChild(text);
  }

  function renderCatalogCard(item) {
    var status = item.progress && item.progress.status || "not_started";
    var percent = Number(item.progress && item.progress.progress_percent || 0);
    var action = status === "completed" ? "Посмотреть результат" : status === "in_progress" ? "Продолжить" : "Начать бесплатно";
    var statusText = status === "completed" ? "Завершено" : status === "in_progress" ? "В процессе" : "Не начато";
    var skills = (item.skills || []).slice(0, 4).map(function (skill) {
      return "<span>" + escapeHtml(skill) + "</span>";
    }).join("");

    return "" +
      '<article class="rx-experience-card">' +
        '<div class="rx-card-art">' +
          '<img src="/roleexperience-card.jpg" alt="Проектный координатор в рабочей симуляции" loading="lazy">' +
          '<span><b>01</b><small>ROLE EXPERIENCE</small></span>' +
        '</div>' +
        '<div class="rx-card-copy">' +
          '<span>' + escapeHtml(item.eyebrow) + '</span>' +
          '<h3>' + escapeHtml(item.title) + '</h3>' +
          '<h4>' + escapeHtml(item.role) + ' · ' + escapeHtml(item.organization) + '</h4>' +
          '<p>' + escapeHtml(item.summary) + '</p>' +
          '<div class="rx-card-skills">' + skills + '</div>' +
        '</div>' +
        '<div class="rx-card-action">' +
          '<div>' +
            '<div class="rx-card-meta">' +
              '<div><span>Время</span><strong>≈ ' + escapeHtml(item.duration_minutes) + ' минут</strong></div>' +
              '<div><span>Уровень</span><strong>' + escapeHtml(item.level) + '</strong></div>' +
              '<div><span>Задания</span><strong>' + escapeHtml(item.task_count) + '</strong></div>' +
            '</div>' +
            '<div class="rx-card-progress"><div><span>' + statusText + '</span><strong>' + percent + '%</strong></div><i><b style="width:' + percent + '%"></b></i></div>' +
          '</div>' +
          '<a class="rx-btn rx-btn-primary" data-role-experience-slug="' + escapeHtml(item.slug) + '" href="/role-experience/' + encodeURIComponent(item.slug) + '">' + action + ' <span>→</span></a>' +
        '</div>' +
      '</article>';
  }

  async function initCatalog() {
    var payload = await api("/api/role-experiences");
    var list = document.getElementById("roleExperienceList");
    var experiences = Array.isArray(payload.experiences) ? payload.experiences : [];
    list.innerHTML = experiences.length
      ? experiences.map(renderCatalogCard).join("")
      : '<div class="rx-partner-note"><div><h2>Новые роли готовятся</h2><p>Скоро здесь появятся первые рабочие симуляции.</p></div></div>';
    list.querySelectorAll("[data-role-experience-slug]").forEach(function (link) {
      link.addEventListener("click", function () {
        trackEvent("experience_click", link.dataset.roleExperienceSlug);
      });
    });
    catalog.hidden = false;
    showApp();
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value == null ? "" : String(value);
  }

  function isTaskComplete(taskId) {
    return Boolean(progress && Array.isArray(progress.completed_tasks) && progress.completed_tasks.includes(taskId));
  }

  function renderProgress() {
    var total = experience.tasks.length;
    var completed = Number(progress.completed_count || 0);
    var percent = Number(progress.progress_percent || 0);
    setText("experienceProgressLabel", completed + " из " + total + " заданий");
    setText("experienceProgressValue", percent + "%");
    document.getElementById("experienceProgressBar").style.width = percent + "%";
  }

  function renderTaskNav() {
    var nav = document.getElementById("experienceTaskNav");
    nav.innerHTML = "";
    experience.tasks.forEach(function (task, index) {
      var button = document.createElement("button");
      var marker = isTaskComplete(task.id) ? "✓" : task.number;
      button.type = "button";
      button.className = "rx-task-nav-button" + (index === currentTaskIndex ? " is-active" : "") + (isTaskComplete(task.id) ? " is-complete" : "");
      button.innerHTML = "<i>" + escapeHtml(marker) + "</i><span>" + escapeHtml(task.title) + "</span>";
      button.addEventListener("click", function () {
        currentTaskIndex = index;
        renderRunner();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      nav.appendChild(button);
    });
  }

  function updateCharacterCount() {
    var task = experience.tasks[currentTaskIndex];
    var answerField = document.getElementById("taskAnswer");
    var field = answerField.closest(".rx-answer-field");
    var length = answerField.value.trim().length;
    setText("taskCharacterCount", length);
    field.classList.toggle("is-short", length > 0 && length < task.min_characters);
  }

  function renderTask() {
    var task = experience.tasks[currentTaskIndex];
    var answer = progress.answers && progress.answers[task.id] || "";
    setText("taskNumber", "ЗАДАНИЕ " + task.number);
    setText("taskTitle", task.title);
    setText("taskDuration", "≈ " + task.duration_minutes + " минут");
    setText("taskContext", task.context);
    setText("taskAssignment", task.assignment);
    setText("taskDeliverable", task.deliverable);
    setText("taskCharacterMinimum", task.min_characters);
    setText("taskFeedback", "");

    var hints = document.getElementById("taskHints");
    hints.innerHTML = (task.hints || []).map(function (hint) { return "<li>" + escapeHtml(hint) + "</li>"; }).join("");
    var answerField = document.getElementById("taskAnswer");
    answerField.value = answer;
    updateCharacterCount();

    var model = document.getElementById("taskModelAnswer");
    if (task.model_answer) {
      setText("taskModelAnswerText", task.model_answer);
      model.hidden = false;
    } else {
      setText("taskModelAnswerText", "");
      model.hidden = true;
    }

    document.getElementById("previousTaskButton").disabled = currentTaskIndex === 0;
    document.getElementById("nextTaskButton").hidden = currentTaskIndex === experience.tasks.length - 1;
    document.getElementById("completeExperienceButton").hidden = currentTaskIndex !== experience.tasks.length - 1 || progress.status === "completed";
  }

  function renderRunner() {
    renderProgress();
    renderTaskNav();
    renderTask();
    document.getElementById("experienceCompleteCard").hidden = progress.status !== "completed";
  }

  function setTaskBusy(isBusy) {
    ["saveTaskButton", "nextTaskButton", "completeExperienceButton"].forEach(function (id) {
      var button = document.getElementById(id);
      if (button) button.disabled = Boolean(isBusy);
    });
  }

  async function saveCurrentTask(requireComplete) {
    var task = experience.tasks[currentTaskIndex];
    var answer = document.getElementById("taskAnswer").value.trim();
    var feedback = document.getElementById("taskFeedback");
    feedback.classList.remove("is-success");

    if (!answer) {
      feedback.textContent = "Сначала добавьте рабочий материал.";
      return false;
    }
    if (requireComplete && answer.length < task.min_characters) {
      feedback.textContent = "Добавьте ещё " + (task.min_characters - answer.length) + " символов, чтобы завершить задание.";
      return false;
    }

    setTaskBusy(true);
    try {
      var payload = await api("/api/role-experiences/" + encodeURIComponent(experience.slug) + "/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id, answer: answer }),
      });
      experience = payload.experience;
      progress = payload.progress;
      renderRunner();
      feedback = document.getElementById("taskFeedback");
      feedback.classList.add("is-success");
      feedback.textContent = payload.task_complete ? "Задание сохранено. Пример решения открыт ниже." : "Черновик сохранён.";
      return Boolean(payload.task_complete);
    } catch (error) {
      feedback.textContent = error.message;
      return false;
    } finally {
      setTaskBusy(false);
    }
  }

  async function completeExperience() {
    var saved = await saveCurrentTask(true);
    if (!saved) return;
    var feedback = document.getElementById("taskFeedback");
    if (progress.completed_count !== experience.tasks.length) {
      feedback.classList.remove("is-success");
      feedback.textContent = "Сначала завершите все три задания.";
      return;
    }

    setTaskBusy(true);
    try {
      var payload = await api("/api/role-experiences/" + encodeURIComponent(experience.slug) + "/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      progress = payload.progress;
      renderRunner();
      document.getElementById("experienceCompleteCard").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      feedback.classList.remove("is-success");
      feedback.textContent = error.message;
    } finally {
      setTaskBusy(false);
    }
  }

  async function initRunner(slug) {
    var payload = await api("/api/role-experiences/" + encodeURIComponent(slug));
    experience = payload.experience;
    progress = payload.progress;
    var firstIncomplete = experience.tasks.findIndex(function (task) { return !isTaskComplete(task.id); });
    currentTaskIndex = firstIncomplete >= 0 ? firstIncomplete : experience.tasks.length - 1;

    setText("experienceEyebrow", experience.eyebrow);
    setText("experienceTitle", experience.title);
    setText("experienceSummary", experience.description);
    setText("experienceRole", experience.role);
    setText("experienceOrganization", experience.organization);
    runner.hidden = false;
    renderRunner();
    showApp();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pathParts = window.location.pathname.split("/").filter(Boolean);
    var slug = pathParts[0] === "role-experience" && pathParts[1] ? decodeURIComponent(pathParts[1]) : "";

    document.getElementById("taskAnswer").addEventListener("input", updateCharacterCount);
    document.getElementById("previousTaskButton").addEventListener("click", function () {
      if (currentTaskIndex > 0) {
        currentTaskIndex -= 1;
        renderRunner();
      }
    });
    document.getElementById("saveTaskButton").addEventListener("click", function () { saveCurrentTask(false); });
    document.getElementById("nextTaskButton").addEventListener("click", async function () {
      var saved = await saveCurrentTask(true);
      if (saved && currentTaskIndex < experience.tasks.length - 1) {
        currentTaskIndex += 1;
        renderRunner();
        document.getElementById("experienceTaskPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    document.getElementById("completeExperienceButton").addEventListener("click", completeExperience);
    document.getElementById("experiencePassportLink").addEventListener("click", function () {
      if (experience) trackEvent("passport_open", experience.slug);
    });

    (slug ? initRunner(slug) : initCatalog()).catch(function (error) {
      showFatal(error.message);
    });
  });
})();

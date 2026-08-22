(function () {
  "use strict";

  var state = { passport: null, privacy: null, readiness: null, matches: [], activity: {}, web_cv: {} };
  var saveTimer = null;
  var savingPromise = null;
  var toastTimer = null;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function uid(prefix) {
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }
  function splitList(value) {
    return String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
  }
  function showToast(message, isError) {
    var toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("error", Boolean(isError));
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 3200);
  }
  function setSaveState(text, type) {
    var node = $("#saveState");
    if (!node) return;
    node.textContent = text;
    node.className = "cp-save-state" + (type ? " " + type : "");
  }

  async function request(url, options) {
    var response = await fetch(url, Object.assign({ credentials: "include" }, options || {}));
    if (response.status === 401) {
      window.location.href = "/login?next=/career-passport";
      throw new Error("Нужна авторизация");
    }
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || "Не удалось выполнить запрос");
    return payload;
  }

  function queueSave() {
    clearTimeout(saveTimer);
    setSaveState("Сохраняем…", "saving");
    saveTimer = setTimeout(saveNow, 450);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (!state.passport || !state.privacy) return;
    if (savingPromise) await savingPromise.catch(function () {});
    setSaveState("Сохраняем…", "saving");
    savingPromise = request("/api/career-passport", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passport: state.passport, privacy: state.privacy })
    });
    try {
      var data = await savingPromise;
      state = data;
      render();
      setSaveState("Все изменения сохранены", "");
    } catch (error) {
      setSaveState("Ошибка сохранения", "error");
      showToast(error.message, true);
      throw error;
    } finally {
      savingPromise = null;
    }
  }

  function renderIdentity() {
    var identity = state.passport.identity;
    var goal = state.passport.career_goal;
    $("#profileName").textContent = identity.full_name || "Ваше имя";
    $("#profileHeadline").textContent = goal.profession || identity.headline || "Добавьте карьерное направление";
    var initials = (identity.full_name || "Career Passport").split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase();
    $("#profileInitials").textContent = initials || "CP";
    var meta = [
      identity.university ? "⌂ " + identity.university : "",
      identity.specialty ? "◈ " + identity.specialty : "",
      identity.course ? "○ " + identity.course : "",
      identity.city ? "⌖ " + identity.city : ""
    ].filter(Boolean);
    $("#profileMeta").innerHTML = meta.length ? meta.map(function (item) { return "<span>" + escapeHtml(item) + "</span>"; }).join("") : "<span>Заполните университет, специальность, курс и город</span>";
  }

  function renderReadiness() {
    var readiness = state.readiness || { total: 0, categories: {}, steps: [], completed_steps: 0 };
    var total = Number(readiness.total || 0);
    $("#scoreValue").textContent = total;
    $("#scoreRing").style.setProperty("--score", total);
    var title = total >= 80 ? "Вы готовы выходить на рынок" : total >= 60 ? "Сильная база уже есть" : total >= 35 ? "Профиль набирает силу" : "Начните заполнять паспорт";
    var message = total >= 80 ? "Осталось точечно усилить доказательства и карьерную активность." : total >= 60 ? "Следующие шаги помогут превратить профиль в конкурентное преимущество." : "Каждый заполненный блок открывает более точный следующий шаг.";
    $("#scoreTitle").textContent = title;
    $("#scoreMessage").textContent = message;
    var labels = { web_cv: "Web CV", skills: "Skills", experience: "Experience", career_activity: "Career Activity" };
    $("#scoreBreakdown").innerHTML = Object.keys(labels).map(function (key) {
      var value = Number(readiness.categories[key] || 0);
      return '<div class="cp-metric"><div class="cp-metric-head"><span>' + labels[key] + '</span><strong>' + value + '%</strong></div><div class="cp-metric-bar"><i style="width:' + value + '%"></i></div></div>';
    }).join("");
  }

  function renderGoal() {
    var goal = state.passport.career_goal;
    $("#goalProfession").textContent = goal.profession || "Пока не выбрана";
    var tags = [].concat(goal.industries || [], goal.directions || []);
    $("#goalIndustries").innerHTML = tags.length ? tags.map(function (tag) { return '<span class="cp-chip">' + escapeHtml(tag) + '</span>'; }).join("") : '<span class="cp-chip">Добавьте индустрии</span>';
    var formatLabels = { office: "Офис", hybrid: "Гибрид", remote: "Удалённо" };
    $("#goalFacts").innerHTML = [
      ["Формат", formatLabels[goal.work_format] || "Не выбран"],
      ["Город", goal.city || state.passport.identity.city || "Не выбран"],
      ["Стажировка", goal.internship_ready ? "Готов(а)" : "Не указано"],
      ["Фокус", (goal.directions || [])[0] || "Не выбран"]
    ].map(function (item) { return "<div><dt>" + item[0] + "</dt><dd>" + escapeHtml(item[1]) + "</dd></div>"; }).join("");
  }

  function skillHtml(item, type) {
    return '<span class="cp-skill-item"><span>' + escapeHtml(item.name) + '</span><small>' + escapeHtml(item.level) + '</small><button type="button" data-remove-skill="' + type + '" data-id="' + escapeHtml(item.id) + '" aria-label="Удалить">×</button></span>';
  }

  function renderSkills() {
    $("#hardSkills").innerHTML = (state.passport.skills.hard || []).map(function (item) { return skillHtml(item, "hard"); }).join("") || '<span class="cp-skill-item">Пока пусто</span>';
    $("#softSkills").innerHTML = (state.passport.skills.soft || []).map(function (item) { return skillHtml(item, "soft"); }).join("") || '<span class="cp-skill-item">Пока пусто</span>';
    $("#languages").innerHTML = (state.passport.skills.languages || []).map(function (item) { return skillHtml(item, "languages"); }).join("") || '<span class="cp-skill-item">Пока пусто</span>';
  }

  function renderProjects() {
    var projects = state.passport.projects || [];
    $("#projectEmpty").hidden = projects.length > 0;
    $("#projectList").innerHTML = projects.map(function (item) {
      var subtitle = [item.role, item.team, item.date].filter(Boolean).join(" · ");
      return '<article class="cp-item-card"><span class="cp-item-mark">P</span><div class="cp-item-copy"><h3>' + escapeHtml(item.title) + '</h3><span>' + escapeHtml(subtitle || "Личный проект") + '</span>' + (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') + (item.result ? '<p class="cp-item-result"><strong>Результат:</strong> ' + escapeHtml(item.result) + '</p>' : '') + '</div><button class="cp-delete" type="button" data-remove-project="' + escapeHtml(item.id) + '" aria-label="Удалить">×</button></article>';
    }).join("");
  }

  function renderExperience() {
    var items = state.passport.experience || [];
    var types = { work: "Работа", internship: "Стажировка", volunteer: "Волонтёрство", freelance: "Freelance" };
    $("#experienceEmpty").hidden = items.length > 0;
    $("#experienceList").innerHTML = items.map(function (item) {
      var period = [item.start_date, item.current ? "Сейчас" : item.end_date].filter(Boolean).join(" — ");
      return '<article class="cp-item-card"><span class="cp-item-mark">E</span><div class="cp-item-copy"><h3>' + escapeHtml(item.position || types[item.type] || "Опыт") + '</h3><span>' + escapeHtml([item.organization, period, types[item.type]].filter(Boolean).join(" · ")) + '</span>' + (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') + '</div><button class="cp-delete" type="button" data-remove-experience="' + escapeHtml(item.id) + '" aria-label="Удалить">×</button></article>';
    }).join("");
  }

  function renderRoadmap() {
    var readiness = state.readiness || { steps: [], completed_steps: 0 };
    var steps = readiness.steps || [];
    var completed = Number(readiness.completed_steps || 0);
    $("#roadmapCount").textContent = completed + " из " + steps.length + " выполнено";
    $("#roadmapBar").style.width = (steps.length ? Math.round(completed / steps.length * 100) : 0) + "%";
    $("#nextSteps").innerHTML = steps.map(function (step) {
      return '<div class="cp-step ' + (step.completed ? "completed" : "") + '"><button class="cp-step-check" type="button" data-toggle-step="' + escapeHtml(step.id) + '" aria-pressed="' + (step.completed ? "true" : "false") + '" aria-label="' + (step.completed ? "Снять отметку" : "Отметить выполненным") + '"' + (step.automatic ? ' title="Выполнено автоматически" disabled' : '') + '>✓</button><div><strong>' + escapeHtml(step.title) + '</strong><p>' + escapeHtml(step.description) + '</p></div><a href="' + escapeHtml(step.href) + '" aria-label="Перейти">→</a></div>';
    }).join("");
  }

  function toggleRoadmapStep(stepId) {
    var allowed = ["career-goal", "skills", "project", "web-cv", "applications"];
    if (allowed.indexOf(stepId) === -1) return;
    var completed = Array.isArray(state.passport.roadmap_completed) ? state.passport.roadmap_completed.slice() : [];
    var index = completed.indexOf(stepId);
    if (index >= 0) completed.splice(index, 1); else completed.push(stepId);
    state.passport.roadmap_completed = completed;
    var step = (state.readiness.steps || []).find(function (item) { return item.id === stepId; });
    if (step && !step.automatic) step.completed = index < 0;
    state.readiness.completed_steps = (state.readiness.steps || []).filter(function (item) { return item.completed; }).length;
    renderRoadmap();
    queueSave();
  }

  function renderMatches() {
    var matches = state.matches || [];
    $("#matchList").innerHTML = matches.length ? matches.map(function (item) {
      return '<a class="cp-match" href="' + escapeHtml(item.href) + '"><span><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml([item.organization, item.location].filter(Boolean).join(" · ")) + '</span></span><span class="cp-match-score">' + Number(item.match_percent || 0) + '%</span></a>';
    }).join("") : '<div class="cp-match"><span><strong>Заполните Career Goal</strong><span>После этого здесь появится персональная подборка.</span></span></div>';
  }

  function renderPublicState() {
    var enabled = Boolean(state.privacy && state.privacy.public_profile);
    var node = $("#publicState");
    node.classList.toggle("on", enabled);
    $("span", node).textContent = enabled ? "Публичный профиль разрешён" : "Публичный профиль выключен";
  }

  function render() {
    if (!state.passport) return;
    renderIdentity();
    renderReadiness();
    renderGoal();
    renderSkills();
    renderProjects();
    renderExperience();
    renderRoadmap();
    renderMatches();
    renderPublicState();
  }

  function fillDialog(id) {
    if (id === "profileDialog") {
      var identity = state.passport.identity;
      var form = $('[data-form="profile"]');
      Object.keys(identity).forEach(function (key) { if (form.elements[key]) form.elements[key].value = identity[key] || ""; });
    }
    if (id === "goalDialog") {
      var goal = state.passport.career_goal;
      var goalForm = $('[data-form="goal"]');
      goalForm.elements.profession.value = goal.profession || "";
      goalForm.elements.industries.value = (goal.industries || []).join(", ");
      goalForm.elements.directions.value = (goal.directions || []).join(", ");
      goalForm.elements.work_format.value = goal.work_format || "";
      goalForm.elements.city.value = goal.city || "";
      goalForm.elements.internship_ready.checked = Boolean(goal.internship_ready);
    }
    if (id === "privacyDialog") fillPrivacyDialog();
    if (id === "projectDialog" || id === "experienceDialog") {
      var entryForm = $("#" + id + " form");
      entryForm.reset();
    }
  }

  function fillPrivacyDialog() {
    var labels = { identity: "Имя и основная информация", career_goal: "Карьерная цель", skills: "Навыки и языки", experience: "Опыт", projects: "Проекты", education: "Образование", achievements: "Достижения", portfolio_links: "Portfolio links" };
    var levels = [["private", "Только я"], ["university", "Университет"], ["employers", "Работодатели"], ["public", "Публично"]];
    var form = $('[data-form="privacy"]');
    form.elements.public_profile.checked = Boolean(state.privacy.public_profile);
    $("#privacyFields").innerHTML = Object.keys(labels).map(function (key) {
      var selected = state.privacy.sections[key] || "private";
      return '<label class="cp-privacy-row"><span>' + labels[key] + '</span><select name="privacy_' + key + '">' + levels.map(function (level) { return '<option value="' + level[0] + '"' + (selected === level[0] ? " selected" : "") + '>' + level[1] + '</option>'; }).join("") + '</select></label>';
    }).join("");
  }

  function submitProfile(form) {
    state.passport.identity = {
      full_name: form.elements.full_name.value.trim(), university: form.elements.university.value.trim(),
      specialty: form.elements.specialty.value.trim(), course: form.elements.course.value.trim(),
      city: form.elements.city.value.trim(), headline: form.elements.headline.value.trim(), about: form.elements.about.value.trim()
    };
  }
  function submitGoal(form) {
    state.passport.career_goal = Object.assign({}, state.passport.career_goal, {
      profession: form.elements.profession.value.trim(), industries: splitList(form.elements.industries.value),
      directions: splitList(form.elements.directions.value), work_format: form.elements.work_format.value,
      city: form.elements.city.value.trim(), internship_ready: form.elements.internship_ready.checked
    });
  }
  function submitProject(form) {
    var title = form.elements.title.value.trim();
    if (!title) throw new Error("Укажите название проекта");
    state.passport.projects.push({ id: uid("project"), title: title, role: form.elements.role.value.trim(), description: form.elements.description.value.trim(), team: form.elements.team.value.trim(), date: form.elements.date.value, result: form.elements.result.value.trim(), skills: splitList(form.elements.skills.value), link: form.elements.link.value.trim() });
  }
  function submitExperience(form) {
    var organization = form.elements.organization.value.trim();
    var position = form.elements.position.value.trim();
    if (!organization || !position) throw new Error("Укажите организацию и позицию");
    state.passport.experience.push({ id: uid("experience"), type: form.elements.type.value, organization: organization, position: position, start_date: form.elements.start_date.value, end_date: form.elements.end_date.value, current: false, description: form.elements.description.value.trim(), skills: splitList(form.elements.skills.value) });
  }
  function submitPrivacy(form) {
    state.privacy.public_profile = form.elements.public_profile.checked;
    Object.keys(state.privacy.sections).forEach(function (key) {
      var field = form.elements["privacy_" + key];
      if (field) state.privacy.sections[key] = field.value;
    });
  }

  function addSkill(type) {
    var prefix = type === "hard" ? "hardSkill" : "softSkill";
    var input = $("#" + prefix + "Input");
    var select = $("#" + prefix + "Level");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    var duplicate = state.passport.skills[type].some(function (item) { return item.name.toLowerCase() === name.toLowerCase(); });
    if (duplicate) { showToast("Этот навык уже добавлен", true); return; }
    state.passport.skills[type].push({ id: uid("skill"), name: name, level: select.value });
    input.value = "";
    renderSkills();
    queueSave();
  }

  function addLanguage() {
    var input = $("#languageInput");
    var name = input.value.trim();
    if (!name) { input.focus(); return; }
    state.passport.skills.languages.push({ id: uid("language"), name: name, level: $("#languageLevel").value });
    input.value = "";
    renderSkills();
    queueSave();
  }

  async function syncWebCv() {
    try {
      setSaveState("Подготавливаем Web CV…", "saving");
      await saveNow();
      var data = await request("/api/career-passport/sync-web-cv", { method: "POST", headers: { "Content-Type": "application/json" } });
      showToast(data.message === "Web CV synchronized and published" ? "Web CV обновлён и опубликован" : "Черновик Web CV создан. Публикация пока выключена");
      window.setTimeout(function () { window.location.href = "/career-profile"; }, 700);
    } catch (error) {
      showToast(error.message, true);
    }
  }

  function bindEvents() {
    document.addEventListener("click", function (event) {
      var stepToggle = event.target.closest("[data-toggle-step]");
      if (stepToggle) {
        toggleRoadmapStep(stepToggle.getAttribute("data-toggle-step"));
        return;
      }
      var opener = event.target.closest("[data-open-dialog]");
      if (opener) {
        var id = opener.getAttribute("data-open-dialog");
        fillDialog(id);
        $("#" + id).showModal();
        return;
      }
      var add = event.target.closest("[data-add-skill]");
      if (add) { addSkill(add.getAttribute("data-add-skill")); return; }
      if (event.target.closest("[data-add-language]")) { addLanguage(); return; }
      var removeSkill = event.target.closest("[data-remove-skill]");
      if (removeSkill) {
        var type = removeSkill.getAttribute("data-remove-skill");
        var id = removeSkill.getAttribute("data-id");
        state.passport.skills[type] = state.passport.skills[type].filter(function (item) { return item.id !== id; });
        renderSkills(); queueSave(); return;
      }
      var removeProject = event.target.closest("[data-remove-project]");
      if (removeProject) { state.passport.projects = state.passport.projects.filter(function (item) { return item.id !== removeProject.getAttribute("data-remove-project"); }); renderProjects(); queueSave(); return; }
      var removeExperience = event.target.closest("[data-remove-experience]");
      if (removeExperience) { state.passport.experience = state.passport.experience.filter(function (item) { return item.id !== removeExperience.getAttribute("data-remove-experience"); }); renderExperience(); queueSave(); return; }
      var submit = event.target.closest("[data-submit-form]");
      if (submit) {
        event.preventDefault();
        var kind = submit.getAttribute("data-submit-form");
        var form = submit.closest("form");
        if (!form.reportValidity()) return;
        try {
          if (kind === "profile") submitProfile(form);
          if (kind === "goal") submitGoal(form);
          if (kind === "project") submitProject(form);
          if (kind === "experience") submitExperience(form);
          if (kind === "privacy") submitPrivacy(form);
          form.closest("dialog").close();
          render();
          queueSave();
        } catch (error) { showToast(error.message, true); }
      }
    });
    ["hardSkillInput", "softSkillInput", "languageInput"].forEach(function (id) {
      $("#" + id).addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (id === "languageInput") addLanguage(); else addSkill(id.indexOf("hard") === 0 ? "hard" : "soft");
      });
    });
    $("#syncWebCvButton").addEventListener("click", syncWebCv);
    $("#syncWebCvButtonAside").addEventListener("click", syncWebCv);
  }

  async function init() {
    bindEvents();
    try {
      state = await request("/api/career-passport");
      render();
      $("#pageLoading").hidden = true;
      $("#passportApp").hidden = false;
    } catch (error) {
      $("#pageLoading p").textContent = error.message;
      showToast(error.message, true);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

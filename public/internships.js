const categoryLabels = {
  all: "Все",
  recommended: "Рекомендуемое",
  ministries: "Министерство",
  akimats: "Акимат",
  quasi: "Квазигоссектор",
  online: "Онлайн",
  other: "Другое",
};

const categoryBadgeClass = {
  ministries: "",
  akimats: "blue",
  quasi: "purple",
  online: "green",
  other: "gray",
};

const goalLabels = {
  study_abroad: "За границу",
  masters: "Магистратура",
  civil_service: "Госслужба",
  international_org: "Международные организации",
  national_company: "Нацкомпании",
  private_sector: "Частный сектор",
  undecided: "Нужен фокус",
};

const englishLabels = {
  any: "Любой уровень английского",
  a1_a2: "Английский A1-A2",
  b1_b2: "Английский B1-B2",
  c1_plus: "Английский C1+",
};

const experienceLabels = {
  any: "Любой опыт",
  none: "Можно без опыта",
  little: "Небольшой опыт",
  internships_or_projects: "Стажировки или проекты",
  already_working_in_field: "Опыт по профилю",
};

const regionLabels = {
  any: "Любой формат",
  kazakhstan: "Казахстан",
  international: "Международный трек",
  online: "Онлайн",
  hybrid: "Гибрид",
};

const savedStatusLabels = {
  saved: "Сохранено",
  want_to_apply: "Хочу податься",
  applied: "Подался",
};

const state = {
  category: "all",
  internships: [],
  canManage: false,
  accessTier: "free",
  featureAccess: {
    saved_items: false,
    recommendations: false,
  },
};

const filtersRoot = document.getElementById("internshipFilters");
const filters = Array.from(document.querySelectorAll(".filter"));
const grid = document.getElementById("internshipsGrid");
const emptyState = document.getElementById("internshipsEmpty");
const form = document.getElementById("internshipForm");
const formStatus = document.getElementById("internshipFormStatus");
const pageStatus = document.getElementById("internshipPageStatus");
const toggleFormButton = document.getElementById("toggleInternshipForm");
const goalSection = document.getElementById("internshipGoalSection");
const goalTitle = document.getElementById("internshipGoalTitle");
const goalDescription = document.getElementById("internshipGoalDescription");
const goalGrid = document.getElementById("internshipGoalGrid");
const goalAction = document.getElementById("internshipGoalAction");

function setActiveFilter(category) {
  state.category = category;
  filters.forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });
}

function updateManagerControls() {
  toggleFormButton.hidden = !state.canManage;

  if (!state.canManage) {
    form.hidden = true;
  }
}

function isValidHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function createBadge(text, className) {
  return createTextElement("span", `badge ${className || ""}`.trim(), text);
}

function createTagRow(values) {
  if (!values.length) {
    return null;
  }

  const wrap = document.createElement("div");
  wrap.className = "taxonomy-chips";
  values.forEach((value) => {
    wrap.appendChild(createTextElement("span", "taxonomy-chip", value));
  });
  return wrap;
}

function createSavedControls(internship) {
  const wrap = document.createElement("div");
  wrap.className = "saved-controls";

  if (!state.featureAccess.saved_items) {
    var upgradeButton = createTextElement("button", "status-chip active", "Избранное в Plus");
    upgradeButton.type = "button";
    upgradeButton.addEventListener("click", function () {
      window.location.href = "/subscribe";
    });
    wrap.appendChild(upgradeButton);
    return wrap;
  }

  Object.keys(savedStatusLabels).forEach((statusKey) => {
    const button = createTextElement(
      "button",
      `status-chip${internship.saved_status === statusKey ? " active" : ""}`,
      savedStatusLabels[statusKey]
    );
    button.type = "button";
    button.addEventListener("click", () => {
      void handleSavedStatusChange(internship.id, statusKey, internship.saved_status === statusKey);
    });
    wrap.appendChild(button);
  });

  if (internship.saved_status) {
    const removeButton = createTextElement("button", "status-chip muted", "Убрать");
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      void handleRemoveSavedItem(internship.id);
    });
    wrap.appendChild(removeButton);
  }

  return wrap;
}

function createInternshipCard(internship) {
  const card = document.createElement("article");
  card.className = `internship-modern${internship.is_recommended ? " recommended-surface" : ""}`;

  const badges = document.createElement("div");
  badges.className = "card-badges";
  badges.appendChild(
    createBadge(
      categoryLabels[internship.category] || categoryLabels.other,
      categoryBadgeClass[internship.category] || ""
    )
  );

  if (internship.is_recommended) {
    badges.appendChild(createBadge("Подходит вам", "match"));
  }

  card.appendChild(badges);
  card.appendChild(createTextElement("h3", "", internship.title));
  card.appendChild(createTextElement("p", "internship-organization", internship.organization));
  card.appendChild(createTextElement("p", "", internship.description));

  if (internship.recommendation_reasons && internship.recommendation_reasons.length) {
    card.appendChild(
      createTextElement(
        "p",
        "match-note",
        `Подходит вам: ${internship.recommendation_reasons.join(", ")}.`
      )
    );
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(createTextElement("span", "", `Локация: ${internship.location}`));
  meta.appendChild(createTextElement("span", "", `Срок: ${internship.duration}`));
  if (internship.deadline_date) {
    meta.appendChild(createTextElement("span", "", `Дедлайн: ${internship.deadline_date}`));
  }
  meta.appendChild(
    createTextElement(
      "span",
      "",
      englishLabels[internship.required_english_level] || englishLabels.any
    )
  );
  meta.appendChild(
    createTextElement(
      "span",
      "",
      experienceLabels[internship.experience_level] || experienceLabels.any
    )
  );
  meta.appendChild(
    createTextElement("span", "", regionLabels[internship.region_type] || regionLabels.any)
  );
  card.appendChild(meta);

  const goals = createTagRow(
    (internship.target_goals || []).map((goal) => goalLabels[goal] || goal)
  );
  if (goals) {
    card.appendChild(goals);
  }

  card.appendChild(createSavedControls(internship));

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (isValidHttpUrl(internship.apply_url)) {
    const applyLink = document.createElement("a");
    applyLink.className = "btn primary";
    applyLink.href = internship.apply_url;
    applyLink.target = "_blank";
    applyLink.rel = "noopener noreferrer";
    applyLink.textContent = "Откликнуться";
    actions.appendChild(applyLink);
  } else {
    const disabledButton = createTextElement("button", "btn secondary", "Контакты уточняются");
    disabledButton.type = "button";
    disabledButton.disabled = true;
    actions.appendChild(disabledButton);
  }

  if (internship.can_delete) {
    const deleteButton = createTextElement("button", "btn danger-btn", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      void handleDeleteInternship(internship.id);
    });
    actions.appendChild(deleteButton);
  }

  card.appendChild(actions);
  return card;
}

function renderCardCollection(target, items, createCard) {
  target.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  items.forEach((item, index) => {
    const card = createCard(item);
    if (!prefersReducedMotion) {
      card.classList.add("surface-reveal");
      card.style.setProperty("--reveal-delay", `${Math.min(index, 7) * 60}ms`);
    } else {
      card.classList.add("surface-reveal-visible");
    }
    fragment.appendChild(card);
  });

  target.appendChild(fragment);

  if (!prefersReducedMotion) {
    window.requestAnimationFrame(() => {
      target.querySelectorAll(".surface-reveal").forEach((card) => {
        card.classList.add("surface-reveal-visible");
      });
    });
  }
}

function renderGoalSection(personalization, items) {
  if (!goalSection || !goalTitle || !goalDescription || !goalGrid) {
    return;
  }

  if (!items.length && !(personalization && personalization.upgrade_required)) {
    goalSection.hidden = true;
    goalGrid.innerHTML = "";
    return;
  }

  goalSection.hidden = false;
  goalTitle.textContent = personalization.section_title || "Для вашей цели";
  goalDescription.textContent = personalization.section_description || "";
  goalAction.textContent = personalization && personalization.upgrade_required
    ? "Открыть Plus"
    : "Смотреть рекомендуемое";
  renderCardCollection(goalGrid, items, createInternshipCard);
}

function renderInternships(internships) {
  grid.innerHTML = "";

  if (!internships.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  renderCardCollection(grid, internships, createInternshipCard);
}

async function loadInternships(category) {
  grid.innerHTML = "";
  emptyState.hidden = true;

  try {
    const response = await fetch(
      `/api/internships?category=${encodeURIComponent(category)}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }

    const payload = await response.json();
    const internships = Array.isArray(payload.internships) ? payload.internships : [];

    state.canManage = Boolean(payload.can_manage);
    state.accessTier = payload.access_tier || "free";
    state.featureAccess = payload.feature_access || state.featureAccess;
    state.internships = internships;
    updateManagerControls();
    renderGoalSection(payload.personalization || {}, Array.isArray(payload.for_goal) ? payload.for_goal : []);

    if (
      state.accessTier === "free" &&
      category === "recommended" &&
      !internships.length
    ) {
      emptyState.textContent = "Персональные подборки полностью открываются на Plus. На Free доступен только базовый просмотр части базы.";
    } else {
      emptyState.textContent = "По выбранному фильтру пока нет объявлений.";
    }

    renderInternships(internships);
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = "Не удалось загрузить объявления. Обнови страницу.";
    console.error("Load internships error:", error);
  }
}

function showFormStatus(message, isError) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", Boolean(isError));
  formStatus.classList.toggle("success", Boolean(message) && !isError);
}

function showPageStatus(message, isError) {
  if (!pageStatus) {
    return;
  }

  pageStatus.textContent = message;
  pageStatus.classList.toggle("error", Boolean(isError));
  pageStatus.classList.toggle("success", Boolean(message) && !isError);
}

async function handleDeleteInternship(internshipId) {
  if (!state.canManage) {
    showFormStatus("У вас нет прав на удаление.", true);
    return;
  }

  if (!window.confirm("Удалить это объявление?")) {
    return;
  }

  showFormStatus("Удаляем...");

  try {
    const response = await fetch(`/api/internships/${internshipId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось удалить объявление");
    }

    await loadInternships(state.category);
    showFormStatus("Объявление удалено.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Delete internship error:", error);
  }
}

async function handleSavedStatusChange(internshipId, savedStatus, shouldRemove) {
  try {
    if (shouldRemove) {
      await handleRemoveSavedItem(internshipId);
      return;
    }

    const response = await fetch("/api/saved", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        entityType: "internship",
        entityId: internshipId,
        savedStatus,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось обновить статус");
    }

    showPageStatus("Статус сохранения обновлён.");
    await loadInternships(state.category);
  } catch (error) {
    showPageStatus(error.message, true);
    console.error("Save internship status error:", error);
  }
}

async function handleRemoveSavedItem(internshipId) {
  try {
    const response = await fetch(`/api/saved/internship/${internshipId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось убрать из сохранённых");
    }

    showPageStatus("Сохранение удалено.");
    await loadInternships(state.category);
  } catch (error) {
    showPageStatus(error.message, true);
    console.error("Remove saved internship error:", error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();

  if (!state.canManage) {
    showFormStatus("У вас нет прав на публикацию.", true);
    return;
  }

  const formData = new FormData(form);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    organization: String(formData.get("organization") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    duration: String(formData.get("duration") || "").trim(),
    applyUrl: String(formData.get("applyUrl") || "").trim(),
    deadlineDate: String(formData.get("deadlineDate") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    targetGoals: formData.getAll("targetGoals"),
    requiredEnglishLevel: String(formData.get("requiredEnglishLevel") || "any").trim(),
    experienceLevel: String(formData.get("experienceLevel") || "any").trim(),
    regionType: String(formData.get("regionType") || "any").trim(),
  };

  showFormStatus("Публикуем...");

  try {
    const response = await fetch("/api/internships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось опубликовать объявление");
    }

    form.reset();
    setActiveFilter(payload.category);
    await loadInternships(payload.category);
    showFormStatus("Объявление опубликовано.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Create internship error:", error);
  }
}

function handleFilterClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("filter")) {
    return;
  }

  const category = target.dataset.category || "all";
  setActiveFilter(category);
  void loadInternships(category);
}

function handleToggleForm() {
  if (!state.canManage) {
    return;
  }

  const hidden = form.hidden;
  form.hidden = !hidden;
  toggleFormButton.textContent = hidden ? "Скрыть форму" : "+ Добавить объявление";
}

function handleGoalAction() {
  if (!state.featureAccess.recommendations) {
    window.location.href = "/subscribe";
    return;
  }

  setActiveFilter("recommended");
  void loadInternships("recommended");
}

function init() {
  updateManagerControls();
  filtersRoot.addEventListener("click", handleFilterClick);
  form.addEventListener("submit", handleFormSubmit);
  toggleFormButton.addEventListener("click", handleToggleForm);
  if (goalAction) {
    goalAction.addEventListener("click", handleGoalAction);
  }
  void loadInternships(state.category);
}

init();

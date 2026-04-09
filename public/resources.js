const resourceTypeLabels = {
  all: "Все",
  recommended: "Рекомендуемое",
  cv: "CV",
  interview: "Interview",
  grants: "Grants",
  internships: "Internships",
  career_start: "Career Start",
};

const resourceBadgeClass = {
  cv: "purple",
  interview: "blue",
  grants: "green",
  internships: "",
  career_start: "gray",
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

const state = {
  type: "all",
  resources: [],
  canManage: false,
  accessTier: "free",
  featureAccess: {
    recommendations: false,
  },
};

const filtersRoot = document.getElementById("resourceFilters");
const filters = filtersRoot ? Array.from(filtersRoot.querySelectorAll(".filter")) : [];
const grid = document.getElementById("resourcesGrid");
const emptyState = document.getElementById("resourcesEmpty");
const form = document.getElementById("resourceForm");
const formStatus = document.getElementById("resourceFormStatus");
const toggleFormButton = document.getElementById("toggleResourceForm");
const goalSection = document.getElementById("resourceGoalSection");
const goalTitle = document.getElementById("resourceGoalTitle");
const goalDescription = document.getElementById("resourceGoalDescription");
const goalGrid = document.getElementById("resourceGoalGrid");
const goalAction = document.getElementById("resourceGoalAction");

function setActiveFilter(type) {
  state.type = type;
  filters.forEach((button) => {
    const isActive = button.dataset.type === type;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
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

function createResourceCard(resource) {
  const card = document.createElement("article");
  card.className = `resource-card${resource.is_recommended ? " recommended-surface" : ""}`;

  const badges = document.createElement("div");
  badges.className = "card-badges";
  badges.appendChild(
    createBadge(
      resourceTypeLabels[resource.resource_type] || resourceTypeLabels.career_start,
      resourceBadgeClass[resource.resource_type] || ""
    )
  );
  if (resource.is_recommended) {
    badges.appendChild(createBadge("Подходит вам", "match"));
  }
  card.appendChild(badges);

  card.appendChild(createTextElement("h3", "", resource.title));
  card.appendChild(createTextElement("p", "resource-summary", resource.summary));

  if (resource.body) {
    card.appendChild(createTextElement("p", "resource-body", resource.body));
  }

  if (resource.recommendation_reasons && resource.recommendation_reasons.length) {
    card.appendChild(
      createTextElement(
        "p",
        "match-note",
        `Подходит вам: ${resource.recommendation_reasons.join(", ")}.`
      )
    );
  }

  const meta = document.createElement("div");
  meta.className = "opportunity-meta";
  meta.appendChild(
    createTextElement(
      "span",
      "",
      englishLabels[resource.required_english_level] || englishLabels.any
    )
  );
  meta.appendChild(
    createTextElement(
      "span",
      "",
      experienceLabels[resource.experience_level] || experienceLabels.any
    )
  );
  meta.appendChild(
    createTextElement("span", "", regionLabels[resource.region_type] || regionLabels.any)
  );
  card.appendChild(meta);

  const goals = createTagRow(
    (resource.target_goals || []).map((goal) => goalLabels[goal] || goal)
  );
  if (goals) {
    card.appendChild(goals);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (isValidHttpUrl(resource.source_url)) {
    const sourceLink = document.createElement("a");
    sourceLink.className = "btn primary";
    sourceLink.href = resource.source_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Открыть источник";
    actions.appendChild(sourceLink);
  }

  if (resource.can_delete) {
    const deleteButton = createTextElement("button", "btn danger-btn", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      void handleDeleteResource(resource.id);
    });
    actions.appendChild(deleteButton);
  }

  if (actions.childNodes.length > 0) {
    card.appendChild(actions);
  }

  return card;
}

function renderCardCollection(target, items) {
  target.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  items.forEach((item, index) => {
    const card = createResourceCard(item);
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
    : "Открыть рекомендуемое";
  renderCardCollection(goalGrid, items);
}

function renderResources(resources) {
  grid.innerHTML = "";

  if (!resources.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  renderCardCollection(grid, resources);
}

async function loadResources(type) {
  grid.innerHTML = "";
  emptyState.hidden = true;

  try {
    const response = await fetch(`/api/resources?type=${encodeURIComponent(type)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }

    const payload = await response.json();
    const resources = Array.isArray(payload.resources) ? payload.resources : [];

    state.canManage = Boolean(payload.can_manage);
    state.accessTier = payload.access_tier || "free";
    state.featureAccess = payload.feature_access || state.featureAccess;
    state.resources = resources;
    updateManagerControls();
    renderGoalSection(payload.personalization || {}, Array.isArray(payload.for_goal) ? payload.for_goal : []);

    if (
      state.accessTier === "free" &&
      type === "recommended" &&
      !resources.length
    ) {
      emptyState.textContent = "Персональные подборки материалов доступны в Plus. На Free открыт только базовый просмотр части библиотеки.";
    } else {
      emptyState.textContent = "По выбранному фильтру материалов пока нет.";
    }

    renderResources(resources);
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = "Не удалось загрузить материалы. Обновите страницу.";
    console.error("Load resources error:", error);
  }
}

function showFormStatus(message, isError) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", Boolean(isError));
  formStatus.classList.toggle("success", Boolean(message) && !isError);
}

async function handleDeleteResource(resourceId) {
  if (!state.canManage) {
    showFormStatus("У вас нет прав на удаление.", true);
    return;
  }

  if (!window.confirm("Удалить этот материал?")) {
    return;
  }

  showFormStatus("Удаляем...");

  try {
    const response = await fetch(`/api/resources/${resourceId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось удалить материал");
    }

    await loadResources(state.type);
    showFormStatus("Материал удалён.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Delete resource error:", error);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();

  if (!state.canManage) {
    showFormStatus("Нужна авторизация администратора.", true);
    return;
  }

  const formData = new FormData(form);
  const payload = {
    title: String(formData.get("title") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    body: String(formData.get("body") || "").trim(),
    resourceType: String(formData.get("resourceType") || "").trim(),
    sourceUrl: String(formData.get("sourceUrl") || "").trim(),
    targetGoals: formData.getAll("targetGoals"),
    requiredEnglishLevel: String(formData.get("requiredEnglishLevel") || "any").trim(),
    experienceLevel: String(formData.get("experienceLevel") || "any").trim(),
    regionType: String(formData.get("regionType") || "any").trim(),
  };

  showFormStatus("Публикуем...");

  try {
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось опубликовать материал");
    }

    form.reset();
    setActiveFilter(payload.resourceType);
    await loadResources(payload.resourceType);
    showFormStatus("Материал добавлен.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Create resource error:", error);
  }
}

function handleFilterClick(event) {
  const target = event.target instanceof HTMLElement
    ? event.target.closest(".filter")
    : null;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const type = target.dataset.type || "all";
  setActiveFilter(type);
  void loadResources(type);
}

function handleToggleForm() {
  if (!state.canManage) {
    return;
  }

  const hidden = form.hidden;
  form.hidden = !hidden;
  toggleFormButton.textContent = hidden ? "Скрыть форму" : "+ Добавить материал";
}

function handleGoalAction() {
  if (!state.featureAccess.recommendations) {
    window.location.href = "/subscribe";
    return;
  }

  setActiveFilter("recommended");
  void loadResources("recommended");
}

function init() {
  updateManagerControls();
  setActiveFilter(state.type);
  if (filtersRoot) {
    filtersRoot.addEventListener("click", handleFilterClick);
  }
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }
  if (toggleFormButton) {
    toggleFormButton.addEventListener("click", handleToggleForm);
  }
  if (goalAction) {
    goalAction.addEventListener("click", handleGoalAction);
  }
  void loadResources(state.type);
}

init();

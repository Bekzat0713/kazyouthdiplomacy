const typeLabels = {
  all: "Все",
  recommended: "Рекомендуемое",
  grants: "Грант",
  scholarships: "Стипендия",
  news: "Новость",
  articles: "Статья",
};

const typeBadgeClass = {
  grants: "purple",
  scholarships: "blue",
  news: "green",
  articles: "gray",
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
  type: "all",
  opportunities: [],
  canManage: false,
  accessTier: "free",
  featureAccess: {
    saved_items: false,
    recommendations: false,
  },
};

const filtersRoot = document.getElementById("opportunityFilters");
const filters = filtersRoot ? Array.from(filtersRoot.querySelectorAll(".filter")) : [];
const grid = document.getElementById("opportunitiesGrid");
const emptyState = document.getElementById("opportunitiesEmpty");
const form = document.getElementById("opportunityForm");
const formStatus = document.getElementById("opportunityFormStatus");
const pageStatus = document.getElementById("opportunityPageStatus");
const toggleFormButton = document.getElementById("toggleOpportunityForm");
const goalSection = document.getElementById("opportunityGoalSection");
const goalTitle = document.getElementById("opportunityGoalTitle");
const goalDescription = document.getElementById("opportunityGoalDescription");
const goalGrid = document.getElementById("opportunityGoalGrid");
const goalAction = document.getElementById("opportunityGoalAction");

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

function createSavedControls(opportunity) {
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
      `status-chip${opportunity.saved_status === statusKey ? " active" : ""}`,
      savedStatusLabels[statusKey]
    );
    button.type = "button";
    button.addEventListener("click", () => {
      void handleSavedStatusChange(opportunity.id, statusKey, opportunity.saved_status === statusKey);
    });
    wrap.appendChild(button);
  });

  if (opportunity.saved_status) {
    const removeButton = createTextElement("button", "status-chip muted", "Убрать");
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      void handleRemoveSavedItem(opportunity.id);
    });
    wrap.appendChild(removeButton);
  }

  return wrap;
}

function createOpportunityCard(opportunity) {
  const card = document.createElement("article");
  card.className = `opportunity-card${opportunity.is_recommended ? " recommended-surface" : ""}`;

  if (isValidHttpUrl(opportunity.image_url)) {
    const image = document.createElement("img");
    image.className = "opportunity-image";
    image.src = opportunity.image_url;
    image.alt = opportunity.title || "Opportunity image";
    image.loading = "lazy";
    card.appendChild(image);
  }

  const badges = document.createElement("div");
  badges.className = "card-badges";
  badges.appendChild(
    createBadge(
      typeLabels[opportunity.content_type] || typeLabels.articles,
      typeBadgeClass[opportunity.content_type] || ""
    )
  );
  if (opportunity.is_recommended) {
    badges.appendChild(createBadge("Подходит вам", "match"));
  }
  card.appendChild(badges);

  card.appendChild(createTextElement("h3", "", opportunity.title));
  card.appendChild(createTextElement("p", "opportunity-org", opportunity.organization));
  card.appendChild(createTextElement("p", "", opportunity.summary));

  if (opportunity.recommendation_reasons && opportunity.recommendation_reasons.length) {
    card.appendChild(
      createTextElement(
        "p",
        "match-note",
        `Подходит вам: ${opportunity.recommendation_reasons.join(", ")}.`
      )
    );
  }

  const meta = document.createElement("div");
  meta.className = "opportunity-meta";
  meta.appendChild(createTextElement("span", "", `Регион: ${opportunity.country || "Не указан"}`));
  if (opportunity.deadline) {
    meta.appendChild(createTextElement("span", "", opportunity.deadline));
  }
  if (opportunity.deadline_date) {
    meta.appendChild(createTextElement("span", "", `До: ${opportunity.deadline_date}`));
  }
  meta.appendChild(
    createTextElement(
      "span",
      "",
      englishLabels[opportunity.required_english_level] || englishLabels.any
    )
  );
  meta.appendChild(
    createTextElement(
      "span",
      "",
      experienceLabels[opportunity.experience_level] || experienceLabels.any
    )
  );
  meta.appendChild(
    createTextElement("span", "", regionLabels[opportunity.region_type] || regionLabels.any)
  );
  card.appendChild(meta);

  const goals = createTagRow(
    (opportunity.target_goals || []).map((goal) => goalLabels[goal] || goal)
  );
  if (goals) {
    card.appendChild(goals);
  }

  card.appendChild(createSavedControls(opportunity));

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (isValidHttpUrl(opportunity.source_url)) {
    const sourceLink = document.createElement("a");
    sourceLink.className = "btn primary";
    sourceLink.href = opportunity.source_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Открыть источник";
    actions.appendChild(sourceLink);
  } else {
    const disabledButton = createTextElement("button", "btn secondary", "Источник уточняется");
    disabledButton.type = "button";
    disabledButton.disabled = true;
    actions.appendChild(disabledButton);
  }

  if (opportunity.can_delete) {
    const deleteButton = createTextElement("button", "btn danger-btn", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      void handleDeleteOpportunity(opportunity.id);
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
  renderCardCollection(goalGrid, items, createOpportunityCard);
}

function renderOpportunities(opportunities) {
  grid.innerHTML = "";

  if (!opportunities.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  renderCardCollection(grid, opportunities, createOpportunityCard);
}

async function loadOpportunities(type) {
  grid.innerHTML = "";
  emptyState.hidden = true;

  try {
    const response = await fetch(
      `/api/opportunities?type=${encodeURIComponent(type)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      throw new Error(`Failed with status ${response.status}`);
    }

    const payload = await response.json();
    const opportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];

    state.canManage = Boolean(payload.can_manage);
    state.accessTier = payload.access_tier || "free";
    state.featureAccess = payload.feature_access || state.featureAccess;
    state.opportunities = opportunities;
    updateManagerControls();
    renderGoalSection(payload.personalization || {}, Array.isArray(payload.for_goal) ? payload.for_goal : []);

    if (
      state.accessTier === "free" &&
      type === "recommended" &&
      !opportunities.length
    ) {
      emptyState.textContent = "Персональные подборки полностью открываются на Plus. На Free доступна только часть базы и материалов.";
    } else {
      emptyState.textContent = "По выбранному фильтру публикаций пока нет.";
    }

    renderOpportunities(opportunities);
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = "Не удалось загрузить публикации. Обновите страницу.";
    console.error("Load opportunities error:", error);
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

async function handleDeleteOpportunity(opportunityId) {
  if (!state.canManage) {
    showFormStatus("У вас нет прав на удаление.", true);
    return;
  }

  if (!window.confirm("Удалить эту публикацию?")) {
    return;
  }

  showFormStatus("Удаляем...");

  try {
    const response = await fetch(`/api/opportunities/${opportunityId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось удалить публикацию");
    }

    await loadOpportunities(state.type);
    showFormStatus("Публикация удалена.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Delete opportunity error:", error);
  }
}

async function handleSavedStatusChange(opportunityId, savedStatus, shouldRemove) {
  try {
    if (shouldRemove) {
      await handleRemoveSavedItem(opportunityId);
      return;
    }

    const response = await fetch("/api/saved", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        entityType: "opportunity",
        entityId: opportunityId,
        savedStatus,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось обновить статус");
    }

    showPageStatus("Статус сохранения обновлён.");
    await loadOpportunities(state.type);
  } catch (error) {
    showPageStatus(error.message, true);
    console.error("Save opportunity status error:", error);
  }
}

async function handleRemoveSavedItem(opportunityId) {
  try {
    const response = await fetch(`/api/saved/opportunity/${opportunityId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || "Не удалось убрать из сохранённых");
    }

    showPageStatus("Сохранение удалено.");
    await loadOpportunities(state.type);
  } catch (error) {
    showPageStatus(error.message, true);
    console.error("Remove saved opportunity error:", error);
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
    organization: String(formData.get("organization") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    contentType: String(formData.get("contentType") || "").trim(),
    country: String(formData.get("country") || "").trim(),
    deadline: String(formData.get("deadline") || "").trim(),
    deadlineDate: String(formData.get("deadlineDate") || "").trim(),
    sourceUrl: String(formData.get("sourceUrl") || "").trim(),
    imageUrl: String(formData.get("imageUrl") || "").trim(),
    targetGoals: formData.getAll("targetGoals"),
    requiredEnglishLevel: String(formData.get("requiredEnglishLevel") || "any").trim(),
    experienceLevel: String(formData.get("experienceLevel") || "any").trim(),
    regionType: String(formData.get("regionType") || "any").trim(),
  };

  showFormStatus("Публикуем...");

  try {
    const response = await fetch("/api/opportunities", {
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
    setActiveFilter(payload.contentType);
    await loadOpportunities(payload.contentType);
    showFormStatus("Публикация добавлена.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Create opportunity error:", error);
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
  void loadOpportunities(type);
}

function handleToggleForm() {
  if (!state.canManage) {
    return;
  }

  const hidden = form.hidden;
  form.hidden = !hidden;
  toggleFormButton.textContent = hidden ? "Скрыть форму" : "+ Добавить публикацию";
}

function handleGoalAction() {
  if (!state.featureAccess.recommendations) {
    window.location.href = "/subscribe";
    return;
  }

  setActiveFilter("recommended");
  void loadOpportunities("recommended");
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
  void loadOpportunities(state.type);
}

init();

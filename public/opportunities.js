const typeLabels = {
  all: "Все",
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

const state = {
  type: "all",
  opportunities: [],
  canManage: false,
};

const filtersRoot = document.getElementById("opportunityFilters");
const filters = Array.from(document.querySelectorAll(".filter"));
const grid = document.getElementById("opportunitiesGrid");
const emptyState = document.getElementById("opportunitiesEmpty");
const form = document.getElementById("opportunityForm");
const formStatus = document.getElementById("opportunityFormStatus");
const toggleFormButton = document.getElementById("toggleOpportunityForm");

function setActiveFilter(type) {
  state.type = type;
  filters.forEach((button) => {
    button.classList.toggle("active", button.dataset.type === type);
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

function createOpportunityCard(opportunity) {
  const card = document.createElement("article");
  card.className = "opportunity-card";

  if (isValidHttpUrl(opportunity.image_url)) {
    const image = document.createElement("img");
    image.className = "opportunity-image";
    image.src = opportunity.image_url;
    image.alt = opportunity.title || "Opportunity image";
    image.loading = "lazy";
    card.appendChild(image);
  }

  const badgeClass = typeBadgeClass[opportunity.content_type] || "";
  const badge = createTextElement(
    "div",
    `badge ${badgeClass}`.trim(),
    typeLabels[opportunity.content_type] || typeLabels.articles
  );
  card.appendChild(badge);

  card.appendChild(createTextElement("h3", "", opportunity.title));
  card.appendChild(
    createTextElement("p", "opportunity-org", opportunity.organization)
  );
  card.appendChild(createTextElement("p", "", opportunity.summary));

  const meta = document.createElement("div");
  meta.className = "opportunity-meta";
  meta.appendChild(
    createTextElement("span", "", `Регион: ${opportunity.country || "Не указан"}`)
  );
  if (opportunity.deadline) {
    meta.appendChild(createTextElement("span", "", opportunity.deadline));
  }
  card.appendChild(meta);

  if (isValidHttpUrl(opportunity.source_url)) {
    const sourceLink = document.createElement("a");
    sourceLink.className = "btn primary";
    sourceLink.href = opportunity.source_url;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "Открыть источник";
    card.appendChild(sourceLink);
  } else {
    const disabledButton = createTextElement("button", "btn secondary", "Источник уточняется");
    disabledButton.type = "button";
    disabledButton.disabled = true;
    card.appendChild(disabledButton);
  }

  if (opportunity.can_delete) {
    const deleteButton = createTextElement("button", "btn danger-btn", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      void handleDeleteOpportunity(opportunity.id);
    });
    card.appendChild(deleteButton);
  }

  return card;
}

function renderOpportunities(opportunities) {
  grid.innerHTML = "";

  if (!opportunities.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  opportunities.forEach((opportunity) => {
    fragment.appendChild(createOpportunityCard(opportunity));
  });
  grid.appendChild(fragment);
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
    const opportunities = Array.isArray(payload.opportunities)
      ? payload.opportunities
      : [];

    state.canManage = Boolean(payload.can_manage);
    state.opportunities = opportunities;
    updateManagerControls();
    renderOpportunities(opportunities);
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = "Не удалось загрузить публикации. Обновите страницу.";
    console.error("Load opportunities error:", error);
  }
}

function showFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", isError);
}

async function handleDeleteOpportunity(opportunityId) {
  if (!state.canManage) {
    showFormStatus("У вас нет прав на удаление.", true);
    return;
  }

  const confirmed = window.confirm("Удалить эту публикацию?");
  if (!confirmed) {
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
    sourceUrl: String(formData.get("sourceUrl") || "").trim(),
    imageUrl: String(formData.get("imageUrl") || "").trim(),
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
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("filter")) {
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
  toggleFormButton.textContent = hidden
    ? "Скрыть форму"
    : "+ Добавить публикацию";
}

function init() {
  updateManagerControls();
  filtersRoot.addEventListener("click", handleFilterClick);
  form.addEventListener("submit", handleFormSubmit);
  toggleFormButton.addEventListener("click", handleToggleForm);
  void loadOpportunities(state.type);
}

init();

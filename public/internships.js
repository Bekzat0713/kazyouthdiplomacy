const categoryLabels = {
  all: "Все",
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

const state = {
  category: "all",
  internships: [],
  canManage: false,
};

const filtersRoot = document.getElementById("internshipFilters");
const filters = Array.from(document.querySelectorAll(".filter"));
const grid = document.getElementById("internshipsGrid");
const emptyState = document.getElementById("internshipsEmpty");
const form = document.getElementById("internshipForm");
const formStatus = document.getElementById("internshipFormStatus");
const toggleFormButton = document.getElementById("toggleInternshipForm");

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

function createInternshipCard(internship) {
  const card = document.createElement("article");
  card.className = "internship-modern";

  const badgeClass = categoryBadgeClass[internship.category] || "";
  const badge = createTextElement(
    "div",
    `badge ${badgeClass}`.trim(),
    categoryLabels[internship.category] || categoryLabels.other
  );
  card.appendChild(badge);

  card.appendChild(createTextElement("h3", "", internship.title));
  card.appendChild(
    createTextElement("p", "internship-organization", internship.organization)
  );
  card.appendChild(createTextElement("p", "", internship.description));

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.appendChild(
    createTextElement("span", "", `Локация: ${internship.location}`)
  );
  meta.appendChild(createTextElement("span", "", `Срок: ${internship.duration}`));
  card.appendChild(meta);

  if (isValidHttpUrl(internship.apply_url)) {
    const applyLink = document.createElement("a");
    applyLink.className = "btn primary";
    applyLink.href = internship.apply_url;
    applyLink.target = "_blank";
    applyLink.rel = "noopener noreferrer";
    applyLink.textContent = "Откликнуться";
    card.appendChild(applyLink);
  } else {
    const disabledButton = createTextElement(
      "button",
      "btn secondary",
      "Контакты уточняются"
    );
    disabledButton.type = "button";
    disabledButton.disabled = true;
    card.appendChild(disabledButton);
  }

  if (internship.can_delete) {
    const deleteButton = createTextElement("button", "btn danger-btn", "Удалить");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      void handleDeleteInternship(internship.id);
    });
    card.appendChild(deleteButton);
  }

  return card;
}

function renderInternships(internships) {
  grid.innerHTML = "";

  if (!internships.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  internships.forEach((internship) => {
    fragment.appendChild(createInternshipCard(internship));
  });
  grid.appendChild(fragment);
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
    const internships = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.internships)
        ? payload.internships
        : [];

    state.canManage = Array.isArray(payload)
      ? internships.some((internship) => internship.can_delete)
      : Boolean(payload.can_manage);
    state.internships = internships;
    updateManagerControls();
    renderInternships(internships);
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = "Не удалось загрузить объявления. Обнови страницу.";
    console.error("Load internships error:", error);
  }
}

function showFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", isError);
}

async function handleDeleteInternship(internshipId) {
  if (!state.canManage) {
    showFormStatus("У вас нет прав на удаление.", true);
    return;
  }

  const confirmed = window.confirm("Удалить это объявление?");
  if (!confirmed) {
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
      const message = errorPayload.error || "Не удалось удалить объявление";
      throw new Error(message);
    }

    await loadInternships(state.category);
    showFormStatus("Объявление удалено.");
  } catch (error) {
    showFormStatus(error.message, true);
    console.error("Delete internship error:", error);
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
    description: String(formData.get("description") || "").trim(),
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
      const message = errorPayload.error || "Не удалось опубликовать объявление";
      throw new Error(message);
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

function init() {
  updateManagerControls();
  filtersRoot.addEventListener("click", handleFilterClick);
  form.addEventListener("submit", handleFormSubmit);
  toggleFormButton.addEventListener("click", handleToggleForm);
  void loadInternships(state.category);
}

init();

const repeaterConfigs = {
  education: {
    containerId: "careerEducationList",
    emptyText: "Добавьте университет, программу или курс, который усиливает ваш профиль.",
    fields: [
      { key: "institution", label: "Учебное заведение", type: "text", placeholder: "Nazarbayev University" },
      { key: "degree", label: "Программа / степень", type: "text", placeholder: "BA in Economics" },
      { key: "period", label: "Период", type: "text", placeholder: "2022 - 2026" },
      { key: "details", label: "Детали", type: "textarea", placeholder: "Relevant coursework, GPA, extracurriculars" },
    ],
  },
  experience: {
    containerId: "careerExperienceList",
    emptyText: "Добавьте стажировку, part-time role, leadership role или волонтёрский опыт.",
    fields: [
      { key: "company", label: "Компания / организация", type: "text", placeholder: "UNICEF Youth Office" },
      { key: "role", label: "Роль", type: "text", placeholder: "Research Intern" },
      { key: "period", label: "Период", type: "text", placeholder: "Summer 2025" },
      { key: "details", label: "Детали", type: "textarea", placeholder: "Что вы делали и какой был результат" },
    ],
  },
  projects: {
    containerId: "careerProjectsList",
    emptyText: "Покажите 2–3 лучших проекта: это самый сильный блок для стажировок.",
    fields: [
      { key: "title", label: "Название проекта", type: "text", placeholder: "Career Research Dashboard" },
      { key: "stack", label: "Стек / формат", type: "text", placeholder: "React, Node.js, Figma" },
      { key: "link_url", label: "Ссылка", type: "url", placeholder: "https://..." },
      { key: "summary", label: "Краткое описание", type: "textarea", placeholder: "Проблема, ваше решение, результат" },
    ],
  },
  certificates: {
    containerId: "careerCertificatesList",
    emptyText: "Добавьте сертификаты, которые быстро повышают доверие к профилю.",
    fields: [
      { key: "title", label: "Название", type: "text", placeholder: "Google Data Analytics" },
      { key: "issuer", label: "Организация", type: "text", placeholder: "Coursera" },
      { key: "year", label: "Год", type: "text", placeholder: "2026" },
      { key: "link_url", label: "Ссылка на проверку", type: "url", placeholder: "https://..." },
    ],
  },
  languages: {
    containerId: "careerLanguagesList",
    emptyText: "Добавьте языки и уровень владения.",
    fields: [
      { key: "name", label: "Язык", type: "text", placeholder: "English" },
      { key: "level", label: "Уровень", type: "text", placeholder: "B2 / IELTS 6.5" },
    ],
  },
  links: {
    containerId: "careerLinksList",
    emptyText: "Добавьте GitHub, LinkedIn, Behance, Telegram или другой ключевой канал связи.",
    fields: [
      { key: "label", label: "Подпись", type: "text", placeholder: "LinkedIn" },
      { key: "url", label: "URL", type: "url", placeholder: "https://..." },
    ],
  },
};

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
let careerProfilePayload = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseSkills(rawValue) {
  return String(rawValue || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function createEmptyItem(sectionKey) {
  const config = repeaterConfigs[sectionKey];
  const item = {};
  config.fields.forEach((field) => {
    item[field.key] = "";
  });

  if (sectionKey === "certificates") {
    item.image_url = "";
  }

  return item;
}

function calculateCompletion(profile, isPublic) {
  const checks = [
    Boolean(profile.full_name),
    Boolean(profile.specialization),
    Boolean(profile.photo_url),
    Boolean(profile.about),
    Array.isArray(profile.skills) && profile.skills.length >= 3,
    Array.isArray(profile.projects) && profile.projects.length >= 1,
    Array.isArray(profile.links) && profile.links.length >= 1,
    Array.isArray(profile.certificates) && profile.certificates.length >= 1,
    (Array.isArray(profile.education) && profile.education.length >= 1)
      || (Array.isArray(profile.experience) && profile.experience.length >= 1),
    Boolean(isPublic),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function formatDateTime(value) {
  if (!value) {
    return "Профиль ещё не сохранён.";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Обновлено недавно";
  }

  return "Обновлено " + date.toLocaleString("ru-RU");
}

function setSaveStatus(message, mode) {
  const saveStatus = document.getElementById("careerSaveStatus");
  if (!saveStatus) {
    return;
  }

  saveStatus.textContent = message;
  saveStatus.dataset.mode = mode || "";
}

function readImageFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    if (!file) {
      reject(new Error("Файл не выбран."));
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("Можно загружать только изображения."));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      reject(new Error("Изображение должно быть меньше 4 МБ."));
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ""));
    };
    reader.onerror = function () {
      reject(new Error("Не удалось прочитать изображение."));
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview(imageUrl) {
  const preview = document.getElementById("careerPhotoPreview");
  const removeButton = document.getElementById("careerPhotoRemove");
  if (!preview || !removeButton) {
    return;
  }

  if (!imageUrl) {
    preview.hidden = true;
    preview.innerHTML = "";
    removeButton.hidden = true;
    return;
  }

  preview.hidden = false;
  preview.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="Profile photo preview">`;
  removeButton.hidden = false;
}

function getRepeaterItems(sectionKey) {
  const config = repeaterConfigs[sectionKey];
  const container = document.getElementById(config.containerId);
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll(".career-repeat-item")).map(function (itemElement) {
    const item = {};
    config.fields.forEach(function (field) {
      const input = itemElement.querySelector(`[data-field="${field.key}"]`);
      item[field.key] = input ? input.value.trim() : "";
    });

    if (sectionKey === "certificates") {
      const imageInput = itemElement.querySelector('[data-field="image_url"]');
      item.image_url = imageInput ? imageInput.value.trim() : "";
    }

    return item;
  });
}

function collectProfileFromForm() {
  const profile = careerProfilePayload && careerProfilePayload.profile ? careerProfilePayload.profile : {};

  Object.keys(repeaterConfigs).forEach(function (sectionKey) {
    profile[sectionKey] = getRepeaterItems(sectionKey);
  });

  profile.full_name = document.getElementById("careerFullName").value.trim();
  profile.specialization = document.getElementById("careerSpecialization").value.trim();
  profile.city = document.getElementById("careerCity").value.trim();
  profile.university = document.getElementById("careerUniversity").value.trim();
  profile.photo_url = document.getElementById("careerPhotoUrl").value.trim();
  profile.about = document.getElementById("careerAbout").value.trim();
  profile.skills = parseSkills(document.getElementById("careerSkills").value);

  return profile;
}

function renderCertificateUploader(sectionKey, index, imageUrl) {
  return `
    <div class="career-upload-box career-upload-box-certificate">
      <input data-field="image_url" type="hidden" value="${escapeHtml(imageUrl || "")}">
      <div class="career-certificate-layout">
        <div class="career-certificate-copy">
          <span class="career-upload-title">Изображение сертификата</span>
          <p>Добавьте фото или скан, чтобы сертификат выглядел убедительнее на публичной странице.</p>
          <label class="career-upload-button career-upload-button-inline">
            <input type="file" accept="image/*" data-image-section="${escapeHtml(sectionKey)}" data-image-index="${index}">
            <span>${imageUrl ? "Заменить изображение" : "Загрузить изображение"}</span>
          </label>
          <button type="button" class="career-remove-btn career-remove-btn-soft"${imageUrl ? "" : " hidden"} data-remove-image-section="${escapeHtml(sectionKey)}" data-remove-image-index="${index}">Удалить изображение</button>
        </div>
        <div class="career-certificate-preview${imageUrl ? "" : " is-empty"}">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Certificate preview">` : "<span>Превью сертификата появится здесь</span>"}
        </div>
      </div>
    </div>
  `;
}

function renderRepeater(sectionKey, items) {
  const config = repeaterConfigs[sectionKey];
  const container = document.getElementById(config.containerId);
  if (!container) {
    return;
  }

  const normalizedItems = Array.isArray(items) ? items : [];
  if (!normalizedItems.length) {
    container.innerHTML = `<div class="career-repeat-empty">${escapeHtml(config.emptyText)}</div>`;
    return;
  }

  container.innerHTML = normalizedItems.map(function (item, index) {
    const fieldsMarkup = config.fields.map(function (field) {
      const value = item && item[field.key] ? item[field.key] : "";
      if (field.type === "textarea") {
        return `
          <label class="career-field">
            <span>${escapeHtml(field.label)}</span>
            <textarea data-field="${escapeHtml(field.key)}" rows="4" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value)}</textarea>
          </label>
        `;
      }

      return `
        <label class="career-field">
          <span>${escapeHtml(field.label)}</span>
          <input data-field="${escapeHtml(field.key)}" type="${escapeHtml(field.type || "text")}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || "")}">
        </label>
      `;
    }).join("");

    return `
      <article class="career-repeat-item${sectionKey === "certificates" ? " career-repeat-item-certificate" : ""}" data-index="${index}">
        <div class="career-repeat-head">
          <strong>${escapeHtml(String(index + 1))}</strong>
          <button type="button" class="career-remove-btn" data-remove-section="${escapeHtml(sectionKey)}" data-remove-index="${index}">Удалить</button>
        </div>
        <div class="career-form-grid career-form-grid-compact">
          ${fieldsMarkup}
        </div>
        ${sectionKey === "certificates" ? renderCertificateUploader(sectionKey, index, item && item.image_url ? item.image_url : "") : ""}
      </article>
    `;
  }).join("");
}

function renderGuidance(payload) {
  const guidanceText = document.getElementById("careerGuidanceText");
  const guidanceList = document.getElementById("careerGuidanceList");
  const guidanceBadge = document.getElementById("careerGuidanceBadge");
  if (!guidanceText || !guidanceList || !guidanceBadge) {
    return;
  }

  const guidance = payload && payload.guidance ? payload.guidance : null;
  guidanceText.textContent = guidance && guidance.message
    ? guidance.message
    : "Заполните ключевые блоки профиля, чтобы страница выглядела убедительно.";
  guidanceBadge.textContent = guidance && Array.isArray(guidance.focus_labels) && guidance.focus_labels.length
    ? guidance.focus_labels[0]
    : "Готово";

  guidanceList.innerHTML = "";
  (guidance && Array.isArray(guidance.focus_labels) ? guidance.focus_labels : []).forEach(function (label) {
    const pill = document.createElement("span");
    pill.className = "career-focus-pill";
    pill.textContent = label;
    guidanceList.appendChild(pill);
  });
}

function renderSummary(payload) {
  const summary = payload && payload.summary ? payload.summary : {};
  const urls = payload && payload.urls ? payload.urls : {};
  const isPublic = payload && payload.public_enabled === true;

  document.getElementById("careerCompletionBadge").textContent = `${summary.completion_percent || 0}%`;
  document.getElementById("careerSummaryProjects").textContent = String(summary.projects_count || 0);
  document.getElementById("careerSummarySkills").textContent = String(summary.skills_count || 0);
  document.getElementById("careerSummaryLinks").textContent = String(summary.links_count || 0);
  document.getElementById("careerSummaryCertificates").textContent = String(summary.certificates_count || 0);
  document.getElementById("careerSummaryText").textContent = isPublic
    ? "Публичная страница включена. QR уже может вести HR на вашу карьерную визитку."
    : "Пока это черновик. Включите публичный режим, когда страница будет готова.";
  document.getElementById("careerPublicUrl").value = urls.public_url || "";
  document.getElementById("careerQrImage").src = urls.qr_url || "";
  document.getElementById("careerOpenPublicButton").href = urls.public_url || "#";
  document.getElementById("careerPdfButton").href = urls.pdf_url || "#";
  document.getElementById("careerUpdatedAt").textContent = formatDateTime(payload && payload.updated_at);

  const openButton = document.getElementById("careerOpenPublicButton");
  const pdfButton = document.getElementById("careerPdfButton");
  openButton.classList.toggle("is-disabled", !isPublic);
  pdfButton.classList.toggle("is-disabled", !isPublic);
  openButton.setAttribute("aria-disabled", isPublic ? "false" : "true");
  pdfButton.setAttribute("aria-disabled", isPublic ? "false" : "true");
}

function renderForm(payload) {
  careerProfilePayload = payload;
  const profile = payload && payload.profile ? payload.profile : {};

  document.getElementById("careerPublicEnabled").checked = payload && payload.public_enabled === true;
  document.getElementById("careerFullName").value = profile.full_name || "";
  document.getElementById("careerSpecialization").value = profile.specialization || "";
  document.getElementById("careerCity").value = profile.city || "";
  document.getElementById("careerUniversity").value = profile.university || "";
  document.getElementById("careerPhotoUrl").value = profile.photo_url || "";
  document.getElementById("careerAbout").value = profile.about || "";
  document.getElementById("careerSkills").value = Array.isArray(profile.skills) ? profile.skills.join("\n") : "";
  renderPhotoPreview(profile.photo_url || "");

  Object.keys(repeaterConfigs).forEach(function (sectionKey) {
    renderRepeater(sectionKey, Array.isArray(profile[sectionKey]) ? profile[sectionKey] : []);
  });

  renderGuidance(payload);
  renderSummary(payload);
}

function buildLocalPayload() {
  const draftProfile = collectProfileFromForm();
  const draftPublicEnabled = document.getElementById("careerPublicEnabled").checked;
  const persistedPublicEnabled = careerProfilePayload ? careerProfilePayload.public_enabled === true : false;
  const currentUrls = careerProfilePayload && careerProfilePayload.urls ? careerProfilePayload.urls : {};
  const currentSummary = careerProfilePayload && careerProfilePayload.summary ? careerProfilePayload.summary : {};

  return {
    public_enabled: persistedPublicEnabled,
    updated_at: careerProfilePayload ? careerProfilePayload.updated_at : null,
    profile: draftProfile,
    summary: {
      completion_percent: calculateCompletion(draftProfile, persistedPublicEnabled),
      projects_count: Array.isArray(draftProfile.projects) ? draftProfile.projects.length : 0,
      skills_count: Array.isArray(draftProfile.skills) ? draftProfile.skills.length : 0,
      links_count: Array.isArray(draftProfile.links) ? draftProfile.links.length : 0,
      certificates_count: Array.isArray(draftProfile.certificates) ? draftProfile.certificates.length : 0,
      top_skills: Array.isArray(draftProfile.skills) ? draftProfile.skills.slice(0, 5) : [],
      featured_projects: Array.isArray(draftProfile.projects) ? draftProfile.projects.slice(0, 3).map(function (item) {
        return item.title;
      }).filter(Boolean) : [],
      is_public: persistedPublicEnabled,
    },
    guidance: careerProfilePayload ? careerProfilePayload.guidance : null,
    urls: currentUrls,
    public_slug: careerProfilePayload ? careerProfilePayload.public_slug : "",
    _previous_completion: currentSummary.completion_percent || 0,
    _pending_public_enabled: draftPublicEnabled !== persistedPublicEnabled ? draftPublicEnabled : null,
  };
}

function refreshDraftSummary() {
  if (!careerProfilePayload) {
    return;
  }

  const draftPayload = buildLocalPayload();
  renderSummary(draftPayload);

  if (draftPayload._pending_public_enabled === null || draftPayload._pending_public_enabled === undefined) {
    return;
  }

  const summaryText = document.getElementById("careerSummaryText");
  const openButton = document.getElementById("careerOpenPublicButton");
  const pdfButton = document.getElementById("careerPdfButton");

  if (summaryText) {
    summaryText.textContent = draftPayload._pending_public_enabled
      ? "Public mode will turn on after you save the profile successfully."
      : "Public mode will turn off after you save these changes.";
  }

  if (openButton) {
    openButton.classList.add("is-disabled");
    openButton.setAttribute("aria-disabled", "true");
  }

  if (pdfButton) {
    pdfButton.classList.add("is-disabled");
    pdfButton.setAttribute("aria-disabled", "true");
  }
}

async function loadCareerProfile() {
  try {
    const response = await fetch("/api/career-profile", {
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch career profile");
    }

    renderForm(await response.json());
    setSaveStatus("Черновик загружен.", "neutral");
  } catch (error) {
    console.error(error);
    setSaveStatus("Не удалось загрузить профиль.", "error");
  }
}

async function saveCareerProfile(event) {
  event.preventDefault();

  if (!careerProfilePayload) {
    return;
  }

  const saveButton = document.getElementById("careerSaveButton");
  const requestPayload = {
    public_enabled: document.getElementById("careerPublicEnabled").checked,
    profile: collectProfileFromForm(),
  };

  saveButton.disabled = true;
  setSaveStatus("Сохраняем профиль...", "pending");

  try {
    const response = await fetch("/api/career-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(requestPayload),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload && payload.error ? payload.error : "Failed to save profile");
    }

    renderForm(payload);
    setSaveStatus("Профиль сохранён.", "success");
  } catch (error) {
    console.error(error);
    setSaveStatus(error && error.message ? error.message : "Failed to save profile", "error");
  } finally {
    saveButton.disabled = false;
  }
}

function markDirty() {
  refreshDraftSummary();
  setSaveStatus("Есть несохранённые изменения.", "pending");
}

function handleRepeaterAction(event) {
  const addButton = event.target.closest("[data-add-section]");
  if (addButton) {
    if (!careerProfilePayload) {
      return;
    }

    const sectionKey = addButton.getAttribute("data-add-section");
    const draftProfile = collectProfileFromForm();
    const items = Array.isArray(draftProfile[sectionKey]) ? draftProfile[sectionKey].slice() : [];
    items.push(createEmptyItem(sectionKey));
    careerProfilePayload.profile = draftProfile;
    careerProfilePayload.profile[sectionKey] = items;
    renderRepeater(sectionKey, items);
    markDirty();
    return;
  }

  const removeButton = event.target.closest("[data-remove-section]");
  if (removeButton) {
    if (!careerProfilePayload) {
      return;
    }

    const sectionKey = removeButton.getAttribute("data-remove-section");
    const index = Number.parseInt(removeButton.getAttribute("data-remove-index"), 10);
    const draftProfile = collectProfileFromForm();
    const items = Array.isArray(draftProfile[sectionKey]) ? draftProfile[sectionKey].slice() : [];
    if (Number.isInteger(index) && index >= 0) {
      items.splice(index, 1);
    }
    careerProfilePayload.profile = draftProfile;
    careerProfilePayload.profile[sectionKey] = items;
    renderRepeater(sectionKey, items);
    markDirty();
    return;
  }

  const removeImageButton = event.target.closest("[data-remove-image-section]");
  if (removeImageButton) {
    const sectionKey = removeImageButton.getAttribute("data-remove-image-section");
    const index = Number.parseInt(removeImageButton.getAttribute("data-remove-image-index"), 10);
    const draftProfile = collectProfileFromForm();
    if (Array.isArray(draftProfile[sectionKey]) && draftProfile[sectionKey][index]) {
      draftProfile[sectionKey][index].image_url = "";
      careerProfilePayload.profile = draftProfile;
      renderRepeater(sectionKey, draftProfile[sectionKey]);
      markDirty();
    }
    return;
  }

  if (event.target && event.target.id === "careerPhotoRemove") {
    document.getElementById("careerPhotoUrl").value = "";
    document.getElementById("careerPhotoFile").value = "";
    renderPhotoPreview("");
    markDirty();
  }
}

async function handleImageInputChange(event) {
  const target = event.target;
  if (!target) {
    return;
  }

  if (target.id === "careerPhotoFile") {
    try {
      const dataUrl = await readImageFileAsDataUrl(target.files && target.files[0]);
      document.getElementById("careerPhotoUrl").value = dataUrl;
      renderPhotoPreview(dataUrl);
      markDirty();
    } catch (error) {
      console.error(error);
      setSaveStatus(error.message || "Не удалось загрузить фото.", "error");
      target.value = "";
    }
    return;
  }

  if (target.matches("[data-image-section]")) {
    const sectionKey = target.getAttribute("data-image-section");
    const index = Number.parseInt(target.getAttribute("data-image-index"), 10);
    try {
      const dataUrl = await readImageFileAsDataUrl(target.files && target.files[0]);
      const draftProfile = collectProfileFromForm();
      if (Array.isArray(draftProfile[sectionKey]) && draftProfile[sectionKey][index]) {
        draftProfile[sectionKey][index].image_url = dataUrl;
        careerProfilePayload.profile = draftProfile;
        renderRepeater(sectionKey, draftProfile[sectionKey]);
        markDirty();
      }
    } catch (error) {
      console.error(error);
      setSaveStatus(error.message || "Не удалось загрузить изображение.", "error");
      target.value = "";
    }
  }
}

async function copyPublicLink() {
  if (!careerProfilePayload || !careerProfilePayload.urls || !careerProfilePayload.urls.public_url) {
    return;
  }

  try {
    await navigator.clipboard.writeText(careerProfilePayload.urls.public_url);
    setSaveStatus("Публичная ссылка скопирована.", "success");
  } catch (error) {
    console.error(error);
    setSaveStatus("Не удалось скопировать ссылку.", "error");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("careerProfileForm");
  const copyButton = document.getElementById("careerCopyLinkButton");

  document.addEventListener("click", handleRepeaterAction);
  document.addEventListener("change", function (event) {
    void handleImageInputChange(event);
  });
  form.addEventListener("submit", saveCareerProfile);
  form.addEventListener("input", markDirty);
  form.addEventListener("change", markDirty);
  copyButton.addEventListener("click", copyPublicLink);

  loadCareerProfile();
});

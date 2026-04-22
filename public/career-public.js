function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getSlugFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[1] : "";
}

function isPdfMode() {
  return new URLSearchParams(window.location.search).get("pdf") === "1";
}

function createMetaLine(profile) {
  return [profile.specialization, profile.city, profile.university].filter(Boolean).join(" • ");
}

function createInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function (part) {
      return part.charAt(0).toUpperCase();
    })
    .join("") || "CP";
}

function renderTagList(items, className) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) {
    return "";
  }

  return `<div class="${className}">${values.map(function (item) {
    return `<span>${escapeHtml(item)}</span>`;
  }).join("")}</div>`;
}

function renderLinkButtons(items, emptyText) {
  const values = Array.isArray(items) ? items.filter(function (item) {
    return item && item.url;
  }) : [];

  if (!values.length) {
    return `<p class="career-public-empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="career-public-link-row">
      ${values.map(function (item) {
        return `
          <a class="career-public-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
            ${escapeHtml(item.label || item.url)}
          </a>
        `;
      }).join("")}
    </div>
  `;
}

function renderDetailCards(items, mapper, emptyText) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) {
    return `<p class="career-public-empty">${escapeHtml(emptyText)}</p>`;
  }

  return values.map(mapper).join("");
}

function renderProfile(payload) {
  const app = document.getElementById("careerPublicApp");
  const profile = payload && payload.profile ? payload.profile : {};
  const urls = payload && payload.urls ? payload.urls : {};
  const featuredProjects = Array.isArray(profile.projects) ? profile.projects.slice(0, 3) : [];
  const featuredSkills = Array.isArray(profile.skills) ? profile.skills.slice(0, 5) : [];
  const metaLine = createMetaLine(profile);
  const photoMarkup = profile.photo_url
    ? `<img class="career-public-avatar-image" src="${escapeHtml(profile.photo_url)}" alt="${escapeHtml(profile.full_name || "Career Profile")}">`
    : `<div class="career-public-avatar-fallback">${escapeHtml(createInitials(profile.full_name))}</div>`;

  app.innerHTML = `
    <section class="career-public-shell">
      <article class="career-public-hero">
        <div class="career-public-topbar">
          <span class="career-public-kicker">Career Profile</span>
          <button id="careerPublicPdfBtn" class="btn secondary" type="button">Download PDF</button>
        </div>

        <div class="career-public-hero-grid">
          <div class="career-public-avatar-wrap">
            ${photoMarkup}
          </div>

          <div class="career-public-hero-copy">
            <h1>${escapeHtml(profile.full_name || "Career Profile")}</h1>
            <p class="career-public-meta">${escapeHtml(metaLine || "Career визитка кандидата")}</p>
            ${renderTagList(featuredSkills, "career-public-skill-list")}
            <div class="career-public-actions">
              <a class="btn primary" href="${escapeHtml(urls.pdf_url || "#")}" target="_blank" rel="noopener">Download PDF</a>
              <a class="btn secondary" href="${escapeHtml(urls.public_url || "#")}" target="_blank" rel="noopener">Открыть ссылку</a>
            </div>
            <div class="career-public-contacts">
              ${renderLinkButtons(profile.links, "Контакты и ссылки появятся после заполнения блока Links.")}
            </div>
          </div>
        </div>
      </article>

      <section class="career-public-section">
        <p class="dashboard-kicker">About</p>
        <h2>Обо мне</h2>
        <p class="career-public-about">${escapeHtml(profile.about || "Кандидат ещё не добавил описание.")}</p>
      </section>

      <section class="career-public-section">
        <div class="career-public-section-head">
          <div>
            <p class="dashboard-kicker">Projects</p>
            <h2>Лучшие проекты</h2>
          </div>
        </div>
        <div class="career-public-card-grid">
          ${renderDetailCards(featuredProjects, function (item) {
            return `
              <article class="career-public-card">
                <strong>${escapeHtml(item.title || "Проект")}</strong>
                ${item.stack ? `<span>${escapeHtml(item.stack)}</span>` : ""}
                ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
                ${item.link_url ? `<a href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">Открыть проект</a>` : ""}
              </article>
            `;
          }, "Здесь появятся проекты кандидата.")}
        </div>
      </section>

      <section class="career-public-columns">
        <div class="career-public-section">
          <p class="dashboard-kicker">Education</p>
          <h2>Образование</h2>
          <div class="career-public-stack">
            ${renderDetailCards(profile.education, function (item) {
              return `
                <article class="career-public-list-card">
                  <strong>${escapeHtml(item.institution || item.degree || "Образование")}</strong>
                  ${item.degree ? `<span>${escapeHtml(item.degree)}</span>` : ""}
                  ${item.period ? `<small>${escapeHtml(item.period)}</small>` : ""}
                  ${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}
                </article>
              `;
            }, "Образование пока не заполнено.")}
          </div>
        </div>

        <div class="career-public-section">
          <p class="dashboard-kicker">Experience</p>
          <h2>Опыт</h2>
          <div class="career-public-stack">
            ${renderDetailCards(profile.experience, function (item) {
              return `
                <article class="career-public-list-card">
                  <strong>${escapeHtml(item.role || item.company || "Опыт")}</strong>
                  ${item.company ? `<span>${escapeHtml(item.company)}</span>` : ""}
                  ${item.period ? `<small>${escapeHtml(item.period)}</small>` : ""}
                  ${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}
                </article>
              `;
            }, "Опыт пока не заполнен.")}
          </div>
        </div>
      </section>

      <section class="career-public-columns">
        <div class="career-public-section">
          <p class="dashboard-kicker">Achievements</p>
          <h2>Сертификаты</h2>
          <div class="career-public-stack">
            ${renderDetailCards(profile.certificates, function (item) {
              return `
                <article class="career-public-list-card">
                  ${item.image_url ? `<img class="career-public-certificate-image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title || "Certificate")}">` : ""}
                  <strong>${escapeHtml(item.title || "Сертификат")}</strong>
                  ${item.issuer ? `<span>${escapeHtml(item.issuer)}</span>` : ""}
                  ${item.year ? `<small>${escapeHtml(item.year)}</small>` : ""}
                  ${item.link_url ? `<a href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">Открыть подтверждение</a>` : ""}
                </article>
              `;
            }, "Сертификаты пока не добавлены.")}
          </div>
        </div>

        <div class="career-public-section">
          <p class="dashboard-kicker">Languages</p>
          <h2>Языки</h2>
          <div class="career-public-language-list">
            ${renderDetailCards(profile.languages, function (item) {
              return `
                <article class="career-public-language-item">
                  <strong>${escapeHtml(item.name || "Language")}</strong>
                  ${item.level ? `<span>${escapeHtml(item.level)}</span>` : ""}
                </article>
              `;
            }, "Языки пока не добавлены.")}
          </div>
        </div>
      </section>
    </section>
  `;

  document.title = `${profile.full_name || "Career Profile"} — Career Profile`;

  const pdfButton = document.getElementById("careerPublicPdfBtn");
  if (pdfButton) {
    pdfButton.addEventListener("click", function () {
      const targetUrl = urls && urls.pdf_url ? urls.pdf_url : `${window.location.origin}${window.location.pathname}?pdf=1`;
      window.open(targetUrl, "_blank", "noopener");
    });
  }

  if (isPdfMode()) {
    window.setTimeout(function () {
      window.print();
    }, 300);
  }
}

function renderState(title, description) {
  const app = document.getElementById("careerPublicApp");
  app.innerHTML = `
    <section class="career-public-shell">
      <div class="career-public-state">
        <p class="dashboard-kicker">Career Profile</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
    </section>
  `;
}

async function loadPublicCareerProfile() {
  const slug = getSlugFromPath();
  if (!slug) {
    renderState("Профиль не найден", "Ссылка на карьерную визитку выглядит неполной.");
    return;
  }

  try {
    const response = await fetch(`/api/career-profile/public/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) {
      renderState("Профиль не найден", "Возможно, кандидат ещё не включил публичный режим.");
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch public career profile");
    }

    renderProfile(await response.json());
  } catch (error) {
    console.error(error);
    renderState("Не удалось загрузить профиль", "Попробуйте открыть ссылку позже.");
  }
}

document.addEventListener("DOMContentLoaded", loadPublicCareerProfile);

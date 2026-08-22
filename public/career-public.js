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

const cvTemplateLabels = {
  professional: "Nova",
  portfolio: "Aura",
  editorial: "Atelier",
  midnight: "Noir",
  orbit: "Orbit",
  mono: "Mono",
};

function renderCvxLinks(items) {
  const values = Array.isArray(items) ? items.filter(function (item) { return item && item.url; }) : [];
  if (!values.length) return "";
  return values.map(function (item) {
    return `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label || "Открыть")}<span>↗</span></a>`;
  }).join("");
}

function renderCvxProjects(items) {
  const values = Array.isArray(items) ? items.slice(0, 6) : [];
  return values.map(function (item, index) {
    return `
      <article class="cvx-project-card">
        <div class="cvx-project-index">${String(index + 1).padStart(2, "0")}</div>
        <div class="cvx-project-glow" aria-hidden="true"></div>
        ${item.stack ? `<span class="cvx-project-stack">${escapeHtml(item.stack)}</span>` : ""}
        <h3>${escapeHtml(item.title || "Проект")}</h3>
        ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
        ${item.link_url ? `<a href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">Смотреть проект <span>↗</span></a>` : ""}
      </article>
    `;
  }).join("");
}

function renderCvxTimeline(items, type) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return `<p class="cvx-empty">Раздел скоро будет дополнен.</p>`;
  return values.map(function (item) {
    const title = type === "education" ? (item.degree || item.institution) : (item.role || item.company);
    const place = type === "education" ? item.institution : item.company;
    return `
      <article class="cvx-timeline-item">
        <i aria-hidden="true"></i>
        ${item.period ? `<time>${escapeHtml(item.period)}</time>` : ""}
        <h3>${escapeHtml(title || (type === "education" ? "Образование" : "Опыт"))}</h3>
        ${place && place !== title ? `<strong>${escapeHtml(place)}</strong>` : ""}
        ${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderCvxCertificates(items) {
  const values = Array.isArray(items) ? items : [];
  if (!values.length) return `<p class="cvx-empty">Добавьте достижения и сертификаты.</p>`;
  return values.map(function (item) {
    return `
      <article class="cvx-proof-card">
        ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title || "Сертификат")}">` : `<span class="cvx-proof-mark">✦</span>`}
        <div>
          <h3>${escapeHtml(item.title || "Сертификат")}</h3>
          <p>${escapeHtml([item.issuer, item.year].filter(Boolean).join(" · "))}</p>
          ${item.link_url ? `<a href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">Проверить ↗</a>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderCvxSkillProofs(items) {
  const values = Array.isArray(items) ? items : [];
  return values.map(function (item, index) {
    return `
      <button class="cvx-proof-skill${index === 0 ? " is-active" : ""}" type="button" data-proof-tab="${index}" aria-selected="${index === 0 ? "true" : "false"}">
        <span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(item.skill || "Навык")}
      </button>
    `;
  }).join("");
}

function buildCvxSkillProofs(profile) {
  const skills = Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : [];
  const explicitProofs = Array.isArray(profile.skill_proofs) ? profile.skill_proofs.filter(Boolean) : [];
  const projects = Array.isArray(profile.projects) ? profile.projects.filter(Boolean) : [];
  const experience = Array.isArray(profile.experience) ? profile.experience.filter(Boolean) : [];
  const certificates = Array.isArray(profile.certificates) ? profile.certificates.filter(Boolean) : [];
  const sources = [];

  projects.forEach(function (item) {
    sources.push({
      text: [item.title, item.stack, item.summary].filter(Boolean).join(" "),
      evidence: [item.title, item.summary].filter(Boolean).join(": "),
      result: item.stack || "Проект в портфолио",
      link_url: item.link_url || "",
    });
  });
  experience.forEach(function (item) {
    sources.push({
      text: [item.role, item.company, item.details].filter(Boolean).join(" "),
      evidence: [item.role, item.company, item.details].filter(Boolean).join(" · "),
      result: item.period || "Практический опыт",
      link_url: "",
    });
  });
  certificates.forEach(function (item) {
    sources.push({
      text: [item.title, item.issuer].filter(Boolean).join(" "),
      evidence: [item.title, item.issuer].filter(Boolean).join(" · "),
      result: item.year || "Подтверждённое достижение",
      link_url: item.link_url || "",
    });
  });

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, " ").trim();
  }

  const result = skills.map(function (skill, index) {
    const normalizedSkill = normalize(skill);
    const explicit = explicitProofs.find(function (item) {
      const normalizedProofSkill = normalize(item.skill);
      return normalizedProofSkill === normalizedSkill
        || normalizedProofSkill.includes(normalizedSkill)
        || normalizedSkill.includes(normalizedProofSkill);
    });
    if (explicit) return { ...explicit, skill: explicit.skill || skill };

    const words = normalizedSkill.split(" ").filter(function (word) { return word.length >= 3; });
    const related = sources.find(function (source) {
      const sourceText = normalize(source.text);
      return words.some(function (word) { return sourceText.includes(word); });
    }) || sources[index % Math.max(sources.length, 1)];

    return {
      skill,
      evidence: related && related.evidence
        ? related.evidence
        : "Этот навык является частью моего профессионального профиля и развивается через практику.",
      result: related && related.result ? related.result : "Готов подтвердить на практической задаче",
      link_url: related && related.link_url ? related.link_url : "",
      is_auto: true,
    };
  });

  explicitProofs.forEach(function (proof) {
    const proofSkill = normalize(proof.skill);
    const alreadyIncluded = result.some(function (item) { return normalize(item.skill) === proofSkill; });
    if (!alreadyIncluded) result.push(proof);
  });

  return result.slice(0, 10);
}

function renderCvxProofPanels(items) {
  const values = Array.isArray(items) ? items : [];
  return values.map(function (item, index) {
    return `
      <article class="cvx-proof-story${index === 0 ? " is-active" : ""}" data-proof-panel="${index}" ${index === 0 ? "" : "hidden"}>
        <span class="cvx-proof-story-label">Доказательство / ${String(index + 1).padStart(2, "0")}</span>
        <h3>${escapeHtml(item.skill || "Навык")}</h3>
        ${item.evidence ? `<p>${escapeHtml(item.evidence)}</p>` : ""}
        ${item.result ? `<strong><i>↗</i>${escapeHtml(item.result)}</strong>` : ""}
        ${item.link_url ? `<a href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">Посмотреть подтверждение <span>↗</span></a>` : ""}
      </article>
    `;
  }).join("");
}

function renderCvxStorySlides(profile, skillProofs, projects) {
  const strongestProof = skillProofs[0] || {};
  const secondProof = skillProofs[1] || strongestProof;
  const bestProject = projects[0] || {};
  const skills = Array.isArray(profile.skills) ? profile.skills.slice(0, 5) : [];
  const photoMarkup = profile.photo_url
    ? `<img src="${escapeHtml(profile.photo_url)}" alt="${escapeHtml(profile.full_name || "Web CV")}">`
    : `<div class="cvx-story-avatar-fallback">${escapeHtml(createInitials(profile.full_name))}</div>`;
  const proofCards = skillProofs.slice(0, 3).map(function (item, index) {
    return `<div class="cvx-story-proof-mini"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(item.skill || "Навык")}</strong><small>${escapeHtml(item.result || "Подтверждено практикой")}</small></div>`;
  }).join("");
  const skillCloud = (skills.length ? skills : skillProofs.map(function (item) { return item.skill; }).filter(Boolean).slice(0, 5)).map(function (skill, index) {
    return `<span style="--skill-index:${index}">${escapeHtml(skill)}</span>`;
  }).join("");
  const contactLinks = renderCvxLinks(profile.links);
  return `
    <article class="cvx-story-slide is-active" data-story-slide="0" data-story-scene="intro">
      <div class="cvx-story-scene-copy">
        <span class="cvx-story-eyebrow">01 · Знакомство</span>
        <h2>${escapeHtml(profile.full_name || "Web CV")}</h2>
        <p>${escapeHtml(profile.specialization || "Молодой специалист, открытый новым возможностям")}</p>
        <div class="cvx-story-location">${escapeHtml([profile.city, profile.university].filter(Boolean).join(" · ") || "Open to opportunities")}</div>
      </div>
      <div class="cvx-story-scene-visual cvx-story-portrait-visual">
        <div class="cvx-story-portrait-ring"></div>
        <div class="cvx-story-portrait">${photoMarkup}</div>
        <span>AVAILABLE FOR<br>NEW PROJECTS</span>
        <i>01</i>
      </div>
    </article>
    <article class="cvx-story-slide" data-story-slide="1" data-story-scene="proof" hidden>
      <div class="cvx-story-scene-copy">
        <span class="cvx-story-eyebrow">02 · Моя сила</span>
        <h2>${escapeHtml(strongestProof.skill || skills[0] || "Развитие")}</h2>
        <p>${escapeHtml(strongestProof.evidence || profile.about || "Мои навыки подтверждаются практическими задачами и проектами.")}</p>
        ${strongestProof.result ? `<strong class="cvx-story-result">${escapeHtml(strongestProof.result)}</strong>` : ""}
      </div>
      <div class="cvx-story-scene-visual cvx-story-proof-visual">${proofCards || `<div class="cvx-story-proof-mini"><span>01</span><strong>Потенциал</strong><small>Готов к практическим задачам</small></div>`}<i>PROOF</i></div>
    </article>
    <article class="cvx-story-slide" data-story-slide="2" data-story-scene="project" hidden>
      <div class="cvx-story-scene-copy">
        <span class="cvx-story-eyebrow">03 · Лучший проект</span>
        <h2>${escapeHtml(bestProject.title || "Практический опыт")}</h2>
        <p>${escapeHtml(bestProject.summary || secondProof.evidence || "Я превращаю знания в конкретные действия и результат.")}</p>
        ${bestProject.stack ? `<strong class="cvx-story-result">${escapeHtml(bestProject.stack)}</strong>` : ""}
      </div>
      <div class="cvx-story-scene-visual cvx-story-project-visual"><span>SELECTED<br>WORK</span><strong>01</strong><div>${escapeHtml(bestProject.stack || "Idea · Action · Result")}</div></div>
    </article>
    <article class="cvx-story-slide" data-story-slide="3" data-story-scene="skills" hidden>
      <div class="cvx-story-scene-copy">
        <span class="cvx-story-eyebrow">04 · Что я умею</span>
        <h2>Мой набор<br>сильных сторон.</h2>
        <p>${escapeHtml(secondProof.result || "Быстро погружаюсь в задачи, работаю с людьми и довожу идеи до результата.")}</p>
      </div>
      <div class="cvx-story-scene-visual cvx-story-skill-cloud">${skillCloud || `<span>Growth</span><span>Ideas</span><span>Action</span>`}<i></i></div>
    </article>
    <article class="cvx-story-slide cvx-story-slide-final" data-story-slide="4" data-story-scene="contact" hidden>
      <div class="cvx-story-scene-copy">
        <span class="cvx-story-eyebrow">05 · Следующий шаг</span>
        <h2>Давайте<br>познакомимся.</h2>
        <p>Полное Web CV, проекты и контакты находятся прямо на этой странице.</p>
        <div class="cvx-story-contact-links">${contactLinks || `<button type="button" data-story-close>Вернуться к Web CV</button>`}</div>
      </div>
      <div class="cvx-story-scene-visual cvx-story-contact-visual"><span>LET'S<br>TALK</span><i>↗</i></div>
    </article>
  `;
}

function renderProfile(payload) {
  const app = document.getElementById("careerPublicApp");
  const profile = payload && payload.profile ? payload.profile : {};
  const templateKey = cvTemplateLabels[profile.template_key] ? profile.template_key : "professional";
  const urls = payload && payload.urls ? payload.urls : {};
  const skills = Array.isArray(profile.skills) ? profile.skills.slice(0, 16) : [];
  const projects = Array.isArray(profile.projects) ? profile.projects : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const certificates = Array.isArray(profile.certificates) ? profile.certificates : [];
  const languages = Array.isArray(profile.languages) ? profile.languages : [];
  const skillProofs = buildCvxSkillProofs(profile);
  const metaLine = createMetaLine(profile);
  const photoMarkup = profile.photo_url
    ? `<img src="${escapeHtml(profile.photo_url)}" alt="${escapeHtml(profile.full_name || "Web CV")}">`
    : `<div class="cvx-avatar-fallback">${escapeHtml(createInitials(profile.full_name))}</div>`;

  document.body.dataset.cvTemplate = templateKey;
  app.innerHTML = `
    <div class="cvx-canvas" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="cvx-page">
      <nav class="cvx-nav" aria-label="Навигация Web CV">
        <a class="cvx-wordmark" href="#top"><span>${escapeHtml(createInitials(profile.full_name))}</span><strong>${escapeHtml(profile.full_name || "Web CV")}</strong></a>
        <div class="cvx-nav-links">
          ${skillProofs.length ? `<a href="#proof-mode">Proof Mode</a>` : ""}
          ${projects.length ? `<a href="#projects">Проекты</a>` : ""}
          <a href="#journey">Опыт</a>
          ${certificates.length ? `<a href="#proof">Достижения</a>` : ""}
          <a href="#contact">Контакты</a>
        </div>
        <button id="careerPublicPdfBtn" class="cvx-download" type="button">PDF <span>↓</span></button>
      </nav>

      <header class="cvx-hero" id="top">
        <div class="cvx-hero-copy">
          <span class="cvx-kicker"><i></i> Web CV / ${escapeHtml(cvTemplateLabels[templateKey])}</span>
          <h1>${escapeHtml(profile.full_name || "Ваше имя")}</h1>
          ${profile.specialization ? `<p class="cvx-role">${escapeHtml(profile.specialization)}</p>` : ""}
          ${metaLine ? `<p class="cvx-meta">${escapeHtml(metaLine)}</p>` : ""}
          ${profile.about ? `<p class="cvx-intro">${escapeHtml(profile.about)}</p>` : ""}
          <div class="cvx-hero-actions">
            <button id="cvxStoryButton" class="cvx-story-trigger" type="button"><span>▶</span> Обо мне за 30 секунд</button>
            ${renderCvxLinks(profile.links)}
            ${urls.pdf_url ? `<a class="cvx-primary-action" href="${escapeHtml(urls.pdf_url)}" target="_blank" rel="noopener">Скачать CV <span>↓</span></a>` : ""}
          </div>
        </div>
        <div class="cvx-portrait-stage">
          <div class="cvx-portrait-orbit" aria-hidden="true"><i></i><i></i></div>
          <div class="cvx-portrait">${photoMarkup}</div>
          <span class="cvx-portrait-label">Open to opportunities</span>
          <strong class="cvx-portrait-number">${String(new Date().getFullYear()).slice(-2)}</strong>
        </div>
      </header>

      <section class="cvx-stats" aria-label="Краткая статистика">
        <div><strong>${String(projects.length).padStart(2, "0")}</strong><span>Проектов</span></div>
        <div><strong>${String(skills.length).padStart(2, "0")}</strong><span>Навыков</span></div>
        <div><strong>${String(experience.length).padStart(2, "0")}</strong><span>Позиций</span></div>
        <div><strong>${String(skillProofs.length || certificates.length).padStart(2, "0")}</strong><span>${skillProofs.length ? "Доказательств" : "Достижений"}</span></div>
      </section>

      ${skills.length ? `
        <section class="cvx-skills" aria-label="Навыки">
          <div class="cvx-skills-track">${skills.concat(skills).map(function (skill) { return `<span>✦ ${escapeHtml(skill)}</span>`; }).join("")}</div>
        </section>
      ` : ""}

      ${skillProofs.length ? `
        <section class="cvx-section cvx-proof-mode" id="proof-mode">
          <div class="cvx-section-head"><span>01 / Proof Mode</span><h2>Не обещания.<br>Доказательства.</h2><p>Нажмите на навык и посмотрите, где он применялся и к какому результату привёл.</p></div>
          <div class="cvx-proof-mode-shell">
            <div class="cvx-proof-skill-list" role="tablist" aria-label="Доказательства навыков">${renderCvxSkillProofs(skillProofs)}</div>
            <div class="cvx-proof-story-stage">${renderCvxProofPanels(skillProofs)}<span class="cvx-proof-watermark" aria-hidden="true">PROOF</span></div>
          </div>
        </section>
      ` : ""}

      ${projects.length ? `
        <section class="cvx-section cvx-projects" id="projects">
          <div class="cvx-section-head"><span>02 / Selected work</span><h2>Проекты, которыми<br>я горжусь.</h2><p>Не просто список технологий — задачи, решения и результат.</p></div>
          <div class="cvx-project-grid">${renderCvxProjects(projects)}</div>
        </section>
      ` : ""}

      <section class="cvx-section cvx-journey" id="journey">
        <div class="cvx-section-head"><span>03 / Journey</span><h2>Путь и опыт.</h2><p>Образование, практика и роли, сформировавшие мой профессиональный профиль.</p></div>
        <div class="cvx-journey-grid">
          <div class="cvx-timeline-panel"><div class="cvx-panel-title"><span>Experience</span><h2>Опыт</h2></div><div class="cvx-timeline">${renderCvxTimeline(experience, "experience")}</div></div>
          <div class="cvx-timeline-panel"><div class="cvx-panel-title"><span>Education</span><h2>Образование</h2></div><div class="cvx-timeline">${renderCvxTimeline(education, "education")}</div></div>
        </div>
      </section>

      ${(certificates.length || languages.length) ? `
        <section class="cvx-section cvx-proof" id="proof">
          <div class="cvx-section-head"><span>04 / Credentials</span><h2>Факты вместо<br>громких слов.</h2></div>
          <div class="cvx-proof-layout">
            <div class="cvx-proof-grid">${renderCvxCertificates(certificates)}</div>
            <aside class="cvx-language-card"><span>Languages</span><h2>Языки</h2><div>${languages.map(function (item) { return `<p><strong>${escapeHtml(item.name || "Язык")}</strong><span>${escapeHtml(item.level || "")}</span></p>`; }).join("") || `<p class="cvx-empty">Не указаны</p>`}</div></aside>
          </div>
        </section>
      ` : ""}

      <section class="cvx-contact" id="contact">
        <span>Готовы обсудить идею?</span>
        <h2>Давайте создадим<br>что-то значимое.</h2>
        <div class="cvx-contact-links">${renderCvxLinks(profile.links)}</div>
        <i aria-hidden="true">↗</i>
      </section>

      <footer class="cvx-footer">
        <span>${escapeHtml(profile.full_name || "Web CV")} · ${new Date().getFullYear()}</span>
        <span>Built with <a href="/" target="_blank" rel="noopener">KazYouthDiplomacy</a></span>
      </footer>

      <div id="cvxStoryModal" class="cvx-story-modal" role="dialog" aria-modal="true" aria-label="Обо мне за 30 секунд" hidden>
        <div class="cvx-story-backdrop" data-story-close></div>
        <div class="cvx-story-dialog">
          <div class="cvx-story-topbar">
            <span class="cvx-story-brand"><i>●</i> 30 SECOND STORY</span>
            <div class="cvx-story-step-nav" aria-label="Сцены презентации">
              <button type="button" data-story-jump="0" class="is-active" aria-label="Сцена 1">01</button>
              <button type="button" data-story-jump="1" aria-label="Сцена 2">02</button>
              <button type="button" data-story-jump="2" aria-label="Сцена 3">03</button>
              <button type="button" data-story-jump="3" aria-label="Сцена 4">04</button>
              <button type="button" data-story-jump="4" aria-label="Сцена 5">05</button>
            </div>
            <span class="cvx-story-time">00:30</span>
            <button type="button" data-story-close aria-label="Закрыть">×</button>
          </div>
          <div class="cvx-story-progress"><i></i></div>
          <div class="cvx-story-slides">${renderCvxStorySlides(profile, skillProofs, projects)}</div>
          <div class="cvx-story-controls">
            <button type="button" data-story-prev aria-label="Назад">←</button>
            <span><b id="cvxStoryCurrent">01</b> / 05</span>
            <button type="button" data-story-next aria-label="Дальше">→</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.title = `${profile.full_name || "Web CV"} — KazYouthDiplomacy`;
  const pdfButton = document.getElementById("careerPublicPdfBtn");
  if (pdfButton) {
    pdfButton.addEventListener("click", function () {
      const targetUrl = urls && urls.pdf_url ? urls.pdf_url : `${window.location.origin}${window.location.pathname}?pdf=1`;
      window.open(targetUrl, "_blank", "noopener");
    });
  }
  initializeCvxInteractions();
  if (isPdfMode()) window.setTimeout(function () { window.print(); }, 500);
}

function initializeCvxInteractions() {
  document.querySelectorAll("[data-proof-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      const targetIndex = button.getAttribute("data-proof-tab");
      document.querySelectorAll("[data-proof-tab]").forEach(function (item) {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-proof-panel]").forEach(function (panel) {
        const active = panel.getAttribute("data-proof-panel") === targetIndex;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    });
  });

  const modal = document.getElementById("cvxStoryModal");
  const openButton = document.getElementById("cvxStoryButton");
  if (!modal || !openButton) return;

  const slides = Array.from(modal.querySelectorAll("[data-story-slide]"));
  const currentLabel = document.getElementById("cvxStoryCurrent");
  const progress = modal.querySelector(".cvx-story-progress i");
  let currentIndex = 0;
  let storyTimer = null;

  function showStorySlide(index) {
    currentIndex = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach(function (slide, slideIndex) {
      const active = slideIndex === currentIndex;
      slide.hidden = !active;
      slide.classList.toggle("is-active", active);
    });
    if (currentLabel) currentLabel.textContent = String(currentIndex + 1).padStart(2, "0");
    if (progress) progress.style.width = `${((currentIndex + 1) / slides.length) * 100}%`;
    modal.querySelectorAll("[data-story-jump]").forEach(function (button) {
      button.classList.toggle("is-active", Number(button.getAttribute("data-story-jump")) === currentIndex);
    });
  }

  function stopStoryTimer() {
    if (storyTimer) window.clearInterval(storyTimer);
    storyTimer = null;
  }

  function startStoryTimer() {
    stopStoryTimer();
    storyTimer = window.setInterval(function () {
      if (currentIndex >= slides.length - 1) {
        stopStoryTimer();
        return;
      }
      showStorySlide(currentIndex + 1);
    }, 6000);
  }

  function closeStory() {
    stopStoryTimer();
    modal.hidden = true;
    document.body.classList.remove("cvx-story-open");
    openButton.focus();
  }

  openButton.addEventListener("click", function () {
    showStorySlide(0);
    modal.hidden = false;
    document.body.classList.add("cvx-story-open");
    const closeButton = modal.querySelector(".cvx-story-topbar [data-story-close]");
    if (closeButton) closeButton.focus();
    startStoryTimer();
  });
  modal.querySelectorAll("[data-story-close]").forEach(function (button) { button.addEventListener("click", closeStory); });
  modal.querySelectorAll("[data-story-jump]").forEach(function (button) {
    button.addEventListener("click", function () {
      showStorySlide(Number(button.getAttribute("data-story-jump")) || 0);
      startStoryTimer();
    });
  });
  modal.querySelector("[data-story-prev]").addEventListener("click", function () { showStorySlide(currentIndex - 1); startStoryTimer(); });
  modal.querySelector("[data-story-next]").addEventListener("click", function () { showStorySlide(currentIndex + 1); startStoryTimer(); });
  document.addEventListener("keydown", function (event) {
    if (modal.hidden) return;
    if (event.key === "Escape") closeStory();
    if (event.key === "ArrowRight") showStorySlide(currentIndex + 1);
    if (event.key === "ArrowLeft") showStorySlide(currentIndex - 1);
  });
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

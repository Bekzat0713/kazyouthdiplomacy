// ===============================
// web.js - KazYouthDiplomacy
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 0) Intro splash on home page (2-3s), then reveal website.
  const splash = document.getElementById("site-splash");
  if (document.body.classList.contains("home-page") && splash) {
    const TRANSITION_KEY = "kyd_route_transition_v1";
    const TRANSITION_TTL_MS = 4500;
    const shouldSkipSplash = new URLSearchParams(window.location.search).has("nosplash");
    let hasFreshRouteTransition = false;

    try {
      const raw = sessionStorage.getItem(TRANSITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        hasFreshRouteTransition = Boolean(
          parsed &&
          parsed.ts &&
          Date.now() - Number(parsed.ts) <= TRANSITION_TTL_MS
        );
      }
    } catch (_error) {
      hasFreshRouteTransition = false;
    }

    if (hasFreshRouteTransition || shouldSkipSplash) {
      splash.remove();
      document.body.classList.add("splash-finished");
    } else {
      const splashDuration = prefersReducedMotion ? 700 : 2850;

      document.body.classList.add("splash-active");

      window.setTimeout(() => {
        document.body.classList.remove("splash-active");
        document.body.classList.add("splash-finished");

        window.setTimeout(() => {
          splash.remove();
        }, 900);
      }, splashDuration);
    }
  }

  // 1) Smooth-scroll buttons in achievement sections (if present).
  const achievementButtons = document.querySelectorAll(".achievements-links button");

  achievementButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const section = document.getElementById(targetId);
      if (!section) return;

      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  // 2) Generic fade-in for cards on pages where these blocks exist.
  const fadeElements = document.querySelectorAll(
    ".achievement-card, .dashboard-card, .internship-modern, .opportunity-card, .plan-card, .cta-box"
  );
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const target = entry.target;
      target.classList.add("surface-reveal-visible");
      fadeObserver.unobserve(target);
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });

  fadeElements.forEach((el, index) => {
    if (prefersReducedMotion) {
      el.classList.add("surface-reveal-visible");
      return;
    }

    el.classList.add("surface-reveal");
    el.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
    fadeObserver.observe(el);
  });

  // 3) Hero-bottom reveal on scroll (web.html).
  const revealSections = document.querySelectorAll("[data-scroll-reveal]");
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.remove("reveal-pending");
      entry.target.classList.add("reveal-visible");
      sectionObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -10% 0px",
  });

  revealSections.forEach((section) => {
    if (prefersReducedMotion) {
      section.classList.add("reveal-visible");
      return;
    }

    section.classList.add("reveal-pending");
    sectionObserver.observe(section);
  });

  // 4) Smooth anchor navigation for the homepage storyboard.
  const inPageLinks = document.querySelectorAll('a[href^="#"]:not([href="#"])');

  inPageLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });

  // 5) Horizontal slide between overview and platform panels on the homepage.
  const showcaseShell = document.querySelector(".home-showcase-shell");
  const showcaseButtons = document.querySelectorAll("[data-showcase-switch]");

  if (showcaseShell && showcaseButtons.length) {
    const syncShowcaseButtons = (state) => {
      showcaseButtons.forEach((button) => {
        const isActive = button.dataset.showcaseSwitch === state;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    syncShowcaseButtons(showcaseShell.dataset.showcaseState || "overview");

    showcaseButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextState = button.dataset.showcaseSwitch === "platform" ? "platform" : "overview";
        showcaseShell.dataset.showcaseState = nextState;
        syncShowcaseButtons(nextState);

        showcaseShell.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    });
  }

  initPremiumHomeMotion(prefersReducedMotion);
});

function initPremiumHomeMotion(prefersReducedMotion) {
  if (!document.body.classList.contains("home-page")) {
    return;
  }

  const header = document.getElementById("siteHeader") || document.querySelector(".home-figma-header");
  if (header) {
    let ticking = false;
    const syncHeaderState = () => {
      header.classList.toggle("premium-nav-scrolled", window.scrollY > 12);
      ticking = false;
    };

    syncHeaderState();
    window.addEventListener("scroll", () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(syncHeaderState);
    }, { passive: true });
  }

  const gsap = window.gsap;
  if (prefersReducedMotion || !gsap) {
    document.querySelectorAll(".home-motion").forEach((element) => {
      element.style.opacity = "1";
      element.style.visibility = "visible";
      element.style.transform = "none";
    });
    return;
  }

  gsap.fromTo(
    ".home-motion",
    { y: 24 },
    {
      y: 0,
      duration: 0.88,
      stagger: 0.08,
      ease: "power3.out",
      delay: 0.12,
      clearProps: "transform",
    }
  );

  gsap.to(".career-gps-card", {
    y: -7,
    duration: 4.6,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(".premium-float", {
    y: -9,
    duration: 3.6,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
    stagger: 0.24,
  });
}

function createReviewCard(review) {
  const card = document.createElement("article");
  card.className = "home-figma-review-card";

  const top = document.createElement("div");
  top.className = "home-figma-review-top";

  const tag = document.createElement("span");
  tag.className = "home-figma-review-tag";
  tag.textContent = "Отзыв участника";

  const name = document.createElement("strong");
  name.textContent = review.display_name + (review.age ? `, ${review.age} лет` : "");

  const meta = document.createElement("span");
  meta.className = "home-figma-review-meta";
  meta.textContent = [review.city, review.role_label, review.goal_label ? `цель: ${review.goal_label}` : ""]
    .filter(Boolean)
    .join(" • ");

  const headline = document.createElement("span");
  headline.className = "home-figma-review-headline";
  headline.textContent = review.headline || "Отзыв участника";

  const body = document.createElement("p");
  body.textContent = `“${review.body}”`;

  const result = document.createElement("span");
  result.className = "home-figma-review-note";
  result.textContent = `Результат: ${review.result_summary}`;

  top.appendChild(tag);
  top.appendChild(name);
  top.appendChild(meta);
  top.appendChild(headline);
  card.appendChild(top);
  card.appendChild(body);
  card.appendChild(result);

  return card;
}

function renderReviewStatus(message, tone) {
  const status = document.getElementById("homeReviewStatus");
  if (!status) {
    return;
  }

  status.hidden = !message;
  status.textContent = message || "";
  status.dataset.tone = tone || "";
}

const HOME_AI_STORAGE_KEY = "kyd_home_ai_history_v1";
const HOME_AI_MAX_MESSAGES = 8;
const HOME_AI_GUEST_ANSWERS = {
  "Что это за сайт и кому он подходит?":
    "KazYouthDiplomacy - это Career GPS для студентов и молодых специалистов. Платформа помогает не искать возможности хаотично по разным каналам, а быстрее понять свой маршрут: какие стажировки, гранты, материалы и следующие шаги реально подходят именно вам.",
  "Чем этот сайт поможет именно мне как студенту или молодому специалисту?":
    "Сайт помогает сократить хаос и быстрее перейти к действиям. Здесь можно увидеть карьерные возможности, пройти короткий опрос, получить более персональный маршрут, сохранить интересные варианты и понять, что делать дальше, а не просто читать длинные списки ссылок.",
  "С чего мне лучше начать прямо сейчас на платформе?":
    "Лучший старт - пройти короткий Career GPS опрос. После него проще понять свою цель, открыть нужные разделы и не распыляться. Дальше логика простая: определить направление, посмотреть релевантные возможности и начать собирать свой рабочий shortlist.",
  "Какие первые шаги помогут быстрее найти стажировки, гранты или карьерные возможности?":
    "Сначала определите цель, потом откройте релевантный раздел и сохраните только действительно подходящие варианты. После этого переходите к материалам, чтобы подготовить CV, мотивационное письмо и подачу. На платформе важно не просто смотреть карточки, а собирать понятный следующий шаг."
};

const HOME_AI_DIRECT_ANSWERS = {
  "что это за сайт и кому он подходит":
    "KazYouthDiplomacy - это career GPS для студентов и молодых специалистов. Здесь собраны стажировки, гранты, материалы и personal roadmap, чтобы вы не искали все хаотично по разным каналам.",
  "чем этот сайт поможет именно мне как студенту или молодому специалисту":
    "Сайт помогает быстрее перейти от интереса к действиям: понять цель, открыть подходящие возможности, сохранить нужные варианты и подготовиться к подаче.",
  "с чего мне лучше начать прямо сейчас на платформе":
    "Лучший старт - пройти Career GPS опрос, после этого открыть нужный раздел, собрать shortlist и перейти к подготовке документов.",
  "какие первые шаги помогут быстрее найти стажировки гранты или карьерные возможности":
    "Сначала определите цель, потом откройте релевантный раздел, сохраните только подходящие варианты и переходите к материалам по CV, мотивационному письму и подаче.",
};

function normalizeHomeAiText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^0-9a-zа-я\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHomeAiLocalAnswer(rawPrompt, state = {}) {
  const prompt = String(rawPrompt || "").trim();
  const normalized = normalizeHomeAiText(prompt);
  const isAuthenticated = Boolean(state.isAuthenticated);
  const goalLabel = state.currentUser && state.currentUser.goal_label
    ? String(state.currentUser.goal_label).trim()
    : "";

  if (!normalized) {
    return {
      answer: "Напишите вопрос простыми словами: например `привет`, `что это за сайт`, `с чего начать`, `дай roadmap`, `как податься` или `найди стажировки`.",
      status: "AI Youth уже под рукой: можно начать с любого короткого вопроса.",
      tone: "",
    };
  }

  if (HOME_AI_DIRECT_ANSWERS[normalized]) {
    return {
      answer: HOME_AI_DIRECT_ANSWERS[normalized],
      status: isAuthenticated
        ? "Если хотите, могу продолжить глубже: roadmap, подача, стажировки, материалы."
        : "Для персональных рекомендаций войдите в аккаунт и продолжите диалог.",
      tone: "",
    };
  }

  if (/(^|\s)(привет|здравствуй|здравствуйте|салам|hello|hi)(\s|$)/.test(normalized)) {
    return {
      answer: isAuthenticated
        ? "Привет. Я AI Youth. Могу помочь с навигацией по платформе, personal roadmap, поиском возможностей, материалами по подаче и следующим шагом."
        : "Привет. Я AI Youth. Уже здесь могу объяснить, что это за сайт, чем он полезен, с чего начать и как двигаться к стажировкам, грантам и первым откликам.",
      status: isAuthenticated
        ? "Можно спросить про roadmap, стажировки, гранты, материалы, подписку и подачу."
        : "Для персонального разбора под ваш профиль потом войдите в аккаунт.",
      tone: "",
    };
  }

  if (
    normalized.includes("что это за сайт") ||
    normalized.includes("что за сайт") ||
    normalized.includes("кому подходит") ||
    normalized.includes("для кого сайт")
  ) {
    return {
      answer: "KazYouthDiplomacy - это платформа для студентов и молодых специалистов, где собраны стажировки, гранты, карьерные материалы и personal roadmap. Она помогает быстрее понять, куда двигаться и что делать дальше.",
      status: "Если хотите, следующим сообщением могу подсказать, с какого раздела лучше начать именно вам.",
      tone: "",
    };
  }

  if (
    normalized.includes("чем поможет") ||
    normalized.includes("как поможет") ||
    normalized.includes("какая польза") ||
    normalized.includes("что мне даст")
  ) {
    return {
      answer: "Платформа помогает в трех вещах: найти подходящие возможности, не потерять дедлайны и перейти от просмотра к реальной подаче. Здесь можно выбрать направление, собрать shortlist и открыть материалы по CV, мотивационному письму и интервью.",
      status: "Если напишете цель, AI Youth может сузить рекомендации до конкретных шагов.",
      tone: "",
    };
  }

  if (
    normalized.includes("с чего начать") ||
    normalized.includes("первые шаги") ||
    normalized.includes("что делать сначала") ||
    normalized.includes("как начать")
  ) {
    return {
      answer: "Лучший старт такой: определить цель, пройти Career GPS, открыть релевантный раздел, сохранить подходящие варианты и перейти к подготовке документов. Так вы сразу строите маршрут, а не просто листаете каталог.",
      status: "Самый полезный первый шаг на платформе сейчас - пройти Career GPS.",
      tone: "",
    };
  }

  if (
    normalized.includes("roadmap") ||
    normalized.includes("роадмап") ||
    normalized.includes("маршрут") ||
    normalized.includes("план развития")
  ) {
    const personalizedLead = goalLabel
      ? `Судя по вашему профилю, текущая цель связана с направлением: ${goalLabel}. `
      : "";

    return {
      answer: isAuthenticated
        ? `${personalizedLead}Я бы построил личный roadmap так: определить цель на ближайшие 1-3 месяца, собрать 5-10 релевантных возможностей, параллельно подтянуть CV и мотивационное письмо, потом начать регулярные подачи и следить за дедлайнами. Если дадите сферу или цель, я помогу сузить маршрут.`
        : "Базовый roadmap такой: определить цель, выбрать одно направление, собрать shortlist возможностей, подготовить CV и мотивационное письмо, а затем перейти к регулярным подачам и отслеживанию дедлайнов. Для более личного roadmap лучше войти в аккаунт и пройти Career GPS.",
      status: isAuthenticated
        ? "Можно уточнить roadmap под конкретную цель: международные организации, госслужба, private sector, research и так далее."
        : "Для более личного roadmap нужен аккаунт и данные профиля.",
      tone: isAuthenticated ? "" : "warning",
    };
  }

  if (
    normalized.includes("стажир") ||
    normalized.includes("internship") ||
    normalized.includes("возможност") ||
    normalized.includes("грант") ||
    normalized.includes("стипенд")
  ) {
    return {
      answer: isAuthenticated
        ? "Могу помочь найти подходящие стажировки, гранты и другие возможности. Напишите конкретнее: например `найди стажировки в госорганах`, `дай гранты для студентов`, `что подойдет без опыта`."
        : "На платформе есть стажировки, гранты, стипендии и другие карьерные возможности. Для персонального подбора под ваш профиль лучше войти в аккаунт, но уже сейчас можно начать с Career GPS и релевантных разделов.",
      status: isAuthenticated
        ? "Сформулируйте цель чуть конкретнее, и AI Youth сможет дать более точный ответ."
        : "Персональный подбор доступен после входа в аккаунт.",
      tone: isAuthenticated ? "" : "warning",
    };
  }

  if (
    normalized.includes("как податься") ||
    normalized.includes("как подаваться") ||
    normalized.includes("подач") ||
    normalized.includes("отклик") ||
    normalized.includes("cv") ||
    normalized.includes("резюме") ||
    normalized.includes("мотивацион")
  ) {
    return {
      answer: "Логика подачи обычно такая: прочитать требования, проверить дедлайн, адаптировать CV под конкретную программу, подготовить мотивационное письмо, собрать документы и только после этого отправлять заявку. На платформе для этого как раз есть материалы по карьерному старту, CV, интервью и подготовке к подаче.",
      status: isAuthenticated
        ? "Можно написать `помоги подготовиться к подаче` или `что улучшить перед откликом`, и я продолжу."
        : "Для более точной помощи с подачей войдите в аккаунт и откройте материалы платформы.",
      tone: "",
    };
  }

  if (
    normalized.includes("подписк") ||
    normalized.includes("plus") ||
    normalized.includes("доступ") ||
    normalized.includes("что дает подписка")
  ) {
    return {
      answer: "Подписка нужна там, где важны персонализация и более глубокий доступ. Если коротко, Plus полезен тем, кто хочет не просто смотреть каталог, а получать более практичные рекомендации и двигаться быстрее.",
      status: "Если хотите, могу отдельно объяснить, когда Plus реально стоит брать, а когда пока можно обойтись базовым режимом.",
      tone: "",
    };
  }

  return {
    answer: isAuthenticated
      ? "Я могу помочь с базовой навигацией: roadmap, первые шаги, стажировки, гранты, материалы, подача и доступ. Попробуйте задать вопрос чуть конкретнее."
      : "Я уже могу помочь с вопросами про сайт, старт, roadmap, возможности и подачу. Для личного разбора под ваш профиль войдите в аккаунт и продолжите диалог там.",
    status: isAuthenticated
      ? "Попробуйте уточнить запрос: например `дай roadmap`, `как податься`, `что делать сначала`, `какие стажировки искать`."
      : "Можно начать с вопроса вроде `с чего начать`, `дай roadmap` или `как податься`.",
    tone: "",
  };
}

function loadHomeAiHistory() {
  try {
    const raw = sessionStorage.getItem(HOME_AI_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
      .slice(-HOME_AI_MAX_MESSAGES);
  } catch (_error) {
    return [];
  }
}

function saveHomeAiHistory(messages) {
  try {
    sessionStorage.setItem(
      HOME_AI_STORAGE_KEY,
      JSON.stringify(messages.slice(-HOME_AI_MAX_MESSAGES))
    );
  } catch (_error) {
    // Ignore storage errors in the browser.
  }
}

function createHomeAiMessageNode(message) {
  const item = document.createElement("article");
  item.className = `home-figma-ai-message home-figma-ai-message-${message.role}`;

  const badge = document.createElement("span");
  badge.className = "home-figma-ai-message-badge";
  badge.textContent = message.role === "user" ? "Вы" : "AI";

  const text = document.createElement("p");
  text.className = "home-figma-ai-message-text";
  text.textContent = message.content;

  item.appendChild(badge);
  item.appendChild(text);
  return item;
}

function renderHomeAiMessages(state) {
  if (!state.messagesRoot) {
    return;
  }

  state.messagesRoot.innerHTML = "";
  state.messages.forEach((message) => {
    state.messagesRoot.appendChild(createHomeAiMessageNode(message));
  });
  state.messagesRoot.scrollTop = state.messagesRoot.scrollHeight;
}

function setHomeAiStatus(state, message, tone) {
  if (!state.status) {
    return;
  }

  state.status.textContent = message || "";
  state.status.dataset.tone = tone || "";
}

function setHomeAiSending(state, sending) {
  state.sending = sending;

  if (state.input) {
    state.input.disabled = sending;
  }

  if (state.submit) {
    state.submit.disabled = sending;
    state.submit.textContent = sending ? "AI Youth is thinking..." : "Ask AI Youth";
  }
}

function pushHomeAiMessage(state, role, content) {
  state.messages.push({
    role,
    content: String(content || "").trim(),
  });
  state.messages = state.messages.slice(-HOME_AI_MAX_MESSAGES);
  saveHomeAiHistory(state.messages);
  renderHomeAiMessages(state);
}

async function fetchHomeAiAvailability(state) {
  if (!state.isAuthenticated) {
    return;
  }

  try {
    const response = await fetch("/api/assistant/status", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      state.enabled = false;
      setHomeAiSending(state, false);
      setHomeAiStatus(state, "Живой AI-диалог временно недоступен. Пока можно начать с вопросов и Career GPS.", "warning");
      return;
    }

    const payload = await response.json().catch(() => ({}));
    state.enabled = Boolean(payload && payload.enabled);

    if (!state.enabled) {
      setHomeAiStatus(state, "AI Youth подключен в интерфейс, но на сервере еще не завершена настройка.", "warning");
    }
  } catch (_error) {
    state.enabled = false;
    setHomeAiStatus(state, "AI Youth временно недоступен. Но я все равно могу дать базовые ответы прямо здесь.", "warning");
  } finally {
    setHomeAiSending(state, false);
  }
}

function askHomeAiGuestQuestion(state, question) {
  pushHomeAiMessage(state, "user", question);
  const directAnswer = HOME_AI_GUEST_ANSWERS[question];
  const localAnswer = directAnswer
    ? {
        answer: directAnswer,
        status: "Быстрый ответ открыт. Для персональных рекомендаций войдите в аккаунт.",
        tone: "",
      }
    : getHomeAiLocalAnswer(question, state);
  pushHomeAiMessage(state, "assistant", localAnswer.answer);
  setHomeAiStatus(state, localAnswer.status, localAnswer.tone);
}

async function submitHomeAiPrompt(state, promptText) {
  const text = String(promptText || "").trim();
  if (!text) {
    return;
  }

  if (!state.enabled) {
    pushHomeAiMessage(state, "user", text);
    if (state.input) {
      state.input.value = "";
    }
    const localAnswer = getHomeAiLocalAnswer(text, state);
    pushHomeAiMessage(state, "assistant", localAnswer.answer);
    setHomeAiStatus(state, localAnswer.status, localAnswer.tone || "warning");
    return;
  }

  pushHomeAiMessage(state, "user", text);
  state.input.value = "";
  setHomeAiStatus(state, "Формирую ответ...", "");
  setHomeAiSending(state, true);

  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        page: "dashboard",
        messages: state.messages.slice(-HOME_AI_MAX_MESSAGES),
      }),
    });

    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      pushHomeAiMessage(
        state,
        "assistant",
        payload && payload.error
          ? payload.error
          : "Не получилось получить ответ от AI Youth. Попробуйте еще раз чуть позже."
      );
      setHomeAiStatus(state, "", "");
      return;
    }

    pushHomeAiMessage(
      state,
      "assistant",
      payload && payload.reply
        ? payload.reply
        : "Пока не удалось собрать содержательный ответ. Попробуйте уточнить вопрос."
    );
    setHomeAiStatus(state, "", "");
  } catch (_error) {
    const localAnswer = getHomeAiLocalAnswer(text, state);
    pushHomeAiMessage(
      state,
      "assistant",
      `${localAnswer.answer}\n\nСерверный AI сейчас недоступен, поэтому я ответил в быстром режиме.`
    );
    setHomeAiStatus(
      state,
      localAnswer.status || "Серверный AI временно недоступен, но быстрые ответы продолжают работать.",
      "warning"
    );
  } finally {
    setHomeAiSending(state, false);
    if (state.input) {
      state.input.focus();
    }
  }
}

function initHomeAssistantExperience(options = {}) {
  const root = document.getElementById("homeAiMessages");
  const form = document.getElementById("homeAiForm");
  const input = document.getElementById("homeAiInput");
  const submit = document.getElementById("homeAiSubmit");
  const status = document.getElementById("homeAiStatus");
  const hint = document.getElementById("homeAiHint");
  const modeBadge = document.getElementById("homeAiModeBadge");
  const loginCta = document.getElementById("homeAiLoginCta");
  const dashboardCta = document.getElementById("homeAiDashboardCta");
  const suggestionButtons = Array.from(document.querySelectorAll("[data-home-ai-question]"));

  if (!root || !form || !input || !submit || !status || !hint || !modeBadge) {
    return;
  }

  const state = {
    enabled: Boolean(options.isAuthenticated),
    isAuthenticated: Boolean(options.isAuthenticated),
    currentUser: options.currentUser || null,
    sending: false,
    messagesRoot: root,
    input,
    submit,
    status,
    messages: loadHomeAiHistory(),
  };

  if (!state.messages.length) {
    state.messages = [{
      role: "assistant",
      content: state.isAuthenticated
        ? "Я AI Youth на главной странице. Могу помочь с навигацией по платформе, personal roadmap, поиском возможностей, материалами по подаче и следующим шагом."
        : "Я AI Youth на главной странице. Здесь можно задать даже простой вопрос вроде `привет`, `с чего начать`, `дай roadmap` или `как податься`, а для персонального разбора потом войти в аккаунт."
    }];
  }

  renderHomeAiMessages(state);

  if (loginCta) {
    loginCta.hidden = state.isAuthenticated;
  }

  if (dashboardCta) {
    dashboardCta.hidden = !state.isAuthenticated;
  }

  if (state.isAuthenticated) {
    modeBadge.textContent = "Живой диалог";
    hint.textContent = "Можно спросить про сайт, карьерный путь, roadmap, стажировки, гранты, материалы, подписку и подачу.";
    setHomeAiStatus(state, "Проверяю доступность AI Youth...", "");
    void fetchHomeAiAvailability(state);
  } else {
    modeBadge.textContent = "Быстрые ответы";
    hint.textContent = "Можно писать свободно: `привет`, `что это за сайт`, `дай roadmap`, `как податься`. Для личных рекомендаций потом войдите в аккаунт.";
    input.disabled = false;
    submit.disabled = false;
    setHomeAiStatus(state, "AI Youth уже под рукой: начните с любого вопроса, а для персонального диалога войдите в аккаунт.", "");
  }

  suggestionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.homeAiQuestion || "";
      if (!question) {
        return;
      }

      if (state.isAuthenticated) {
        input.value = question;
        void submitHomeAiPrompt(state, question);
        return;
      }

      askHomeAiGuestQuestion(state, question);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitHomeAiPrompt(state, input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitHomeAiPrompt(state, input.value);
    }
  });
}

function translateCardText(textKey) {
  const currentLang = (window.KYDi18n && window.KYDi18n.getLang()) || "ru";
  const map = {
    ru: {
      "Internship": "Стажировка",
      "Career": "Вакансия",
      "Grant": "Грант",
      "Fellowship": "Стипендия",
      "Research": "Исследования",
      "Digital": "Диджитал",
      "Rolling": "Постоянная",
      "Open": "Открыть"
    },
    en: {
      "Internship": "Internship",
      "Career": "Career",
      "Grant": "Grant",
      "Fellowship": "Fellowship",
      "Research": "Research",
      "Digital": "Digital",
      "Rolling": "Rolling",
      "Open": "Open"
    },
    kk: {
      "Internship": "Тағылымдама",
      "Career": "Бос орын",
      "Grant": "Грант",
      "Fellowship": "Шәкіртақы",
      "Research": "Зерттеулер",
      "Digital": "Диджитал",
      "Rolling": "Тұрақты",
      "Open": "Ашу"
    }
  };
  const langMap = map[currentLang] || map["ru"];
  return langMap[textKey] || textKey;
}

function formatHomeOpportunityDeadline(item) {
  if (item && item.deadline_date) {
    const date = new Date(`${item.deadline_date}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const currentLang = (window.KYDi18n && window.KYDi18n.getLang()) || "ru";
      const locale = currentLang === "kk" ? "kk-KZ" : (currentLang === "en" ? "en-US" : "ru-RU");
      return date.toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
      });
    }

    return String(item.deadline_date);
  }

  if (item && item.duration) {
    return translateCardText(String(item.duration));
  }

  return translateCardText("Rolling");
}

function getHomeOpportunityCategory(item) {
  const listingType = String(item && item.listing_type || "").toLowerCase();
  const title = String(item && item.title || "").toLowerCase();

  if (listingType === "vacancy") {
    return "Career";
  }

  if (title.includes("grant") || title.includes("грант")) {
    return "Grant";
  }

  if (title.includes("fellowship")) {
    return "Fellowship";
  }

  return "Internship";
}

function buildHomeOpportunityTags(item) {
  const tags = [];
  const location = String(item && item.location || "").trim();
  const organization = String(item && item.organization || "").trim();
  const listingType = String(item && item.listing_type || "").toLowerCase();
  const title = String(item && item.title || "").toLowerCase();

  if (location) {
    tags.push(location);
  }

  if (listingType === "vacancy") {
    tags.push("Career");
  } else {
    tags.push("Internship");
  }

  if (title.includes("policy") || title.includes("research") || title.includes("аналит")) {
    tags.push("Research");
  } else if (title.includes("digital") || title.includes("communication") || title.includes("коммуника")) {
    tags.push("Digital");
  } else if (organization) {
    tags.push(organization);
  }

  return Array.from(new Set(tags)).slice(0, 3);
}

function createHomeOpportunityPreviewCard(item, isAuthenticated = false) {
  const card = document.createElement("article");
  const top = document.createElement("div");
  const category = document.createElement("span");
  const deadline = document.createElement("span");
  const title = document.createElement("strong");
  const org = document.createElement("div");
  const description = document.createElement("p");
  const tags = document.createElement("div");
  const link = document.createElement("a");

  // Create sub-element for background cursor tracking glow
  const glow = document.createElement("div");
  glow.className = "premium-card-glow";
  card.appendChild(glow);

  const catName = getHomeOpportunityCategory(item);
  card.className = "home-figma-info-card home-figma-info-card-preview premium-opportunity-card";
  top.className = "premium-opportunity-top";
  category.className = `premium-opportunity-category premium-cat-${catName.toLowerCase()}`;
  deadline.className = "premium-opportunity-deadline";
  org.className = "premium-opportunity-org";
  tags.className = "premium-opportunity-tags";
  link.className = "premium-card-link route-link premium-opportunity-btn";
  
  link.href = isAuthenticated ? "/internships" : "/register";
  link.dataset.transitionDirection = isAuthenticated ? "left" : "right";
  
  const btnText = translateCardText("Open");
  link.innerHTML = `
    <span>${btnText}</span>
    <svg class="arrow-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; display: inline-block; vertical-align: middle; transition: transform 0.2s ease;">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  `;

  category.textContent = translateCardText(catName);
  
  deadline.innerHTML = `
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; display: inline-block; vertical-align: middle; opacity: 0.85;">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
    <span>${formatHomeOpportunityDeadline(item)}</span>
  `;

  org.textContent = item.organization ? String(item.organization) : "";
  title.textContent = String(item.title || "Opportunity");
  description.textContent = item.description_preview ? String(item.description_preview) : "Details appear after loading.";

  buildHomeOpportunityTags(item).forEach((tagText) => {
    const tag = document.createElement("span");
    const localizedTag = translateCardText(tagText);
    
    if (item.location && tagText === item.location) {
      tag.innerHTML = `
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 3px; display: inline-block; vertical-align: middle; opacity: 0.85;">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        <span>${localizedTag}</span>
      `;
      tag.className = "premium-tag-location";
    } else {
      tag.textContent = localizedTag;
    }
    
    tags.appendChild(tag);
  });

  top.appendChild(category);
  top.appendChild(deadline);
  card.appendChild(top);
  if (org.textContent) {
    card.appendChild(org);
  }
  card.appendChild(title);
  card.appendChild(description);
  if (tags.childNodes.length) {
    card.appendChild(tags);
  }
  card.appendChild(link);

  // Mousemove listener for magnetic glow tracking (no 3D tilt to avoid animation override conflicts)
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    card.style.setProperty("--x", `${x}px`);
    card.style.setProperty("--y", `${y}px`);
  });

  return card;
}

function hideLegacyHomeOpportunitiesUi() {
  const legacyEmptyState = document.getElementById("homeOpportunityPreviewEmpty");
  const legacyCta = document.getElementById("homeOpportunitiesViewAll");

  if (legacyEmptyState) {
    legacyEmptyState.hidden = true;
  }

  if (legacyCta) {
    legacyCta.hidden = true;
    legacyCta.closest(".home-figma-opportunity-actions")?.setAttribute("hidden", "hidden");
  }
}

let currentOpportunityIndex = 0;
let opportunityTimer = null;
let opportunityItems = [];

function renderHomeOpportunityPreview(items, isAuthenticated = false) {
  const grid = document.getElementById("homeOpportunityPreviewGrid");
  const emptyState = document.querySelector("[data-home-opportunities-empty]");
  hideLegacyHomeOpportunitiesUi();

  if (!grid || !emptyState) {
    return;
  }

  grid.innerHTML = "";
  opportunityItems = Array.isArray(items) ? items.slice(0, 5) : [];

  if (!opportunityItems.length) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  currentOpportunityIndex = 0;

  // Single card showcase container
  const showcaseContainer = document.createElement("div");
  showcaseContainer.className = "premium-single-card-showcase";

  // Card slot wrapper
  const cardWrapper = document.createElement("div");
  cardWrapper.className = "premium-single-card-wrapper";
  
  const card = createHomeOpportunityPreviewCard(opportunityItems[currentOpportunityIndex], isAuthenticated);
  cardWrapper.appendChild(card);
  showcaseContainer.appendChild(cardWrapper);

  // Pagination navigation dots
  const dotsContainer = document.createElement("div");
  dotsContainer.className = "premium-single-card-dots";
  opportunityItems.forEach((_, idx) => {
    const dot = document.createElement("button");
    dot.className = `premium-card-dot ${idx === 0 ? "active" : ""}`;
    dot.setAttribute("aria-label", `Карточка ${idx + 1}`);
    dot.addEventListener("click", () => {
      if (idx !== currentOpportunityIndex) {
        switchOpportunityCard(idx, isAuthenticated);
      }
    });
    dotsContainer.appendChild(dot);
  });
  showcaseContainer.appendChild(dotsContainer);

  grid.appendChild(showcaseContainer);

  // Start the 30-second interval timer
  startOpportunityTimer(isAuthenticated);

  // Pause timer on hover, resume on leave
  showcaseContainer.addEventListener("mouseenter", stopOpportunityTimer);
  showcaseContainer.addEventListener("mouseleave", () => startOpportunityTimer(isAuthenticated));
}

function switchOpportunityCard(newIndex, isAuthenticated) {
  const cardWrapper = document.querySelector(".premium-single-card-wrapper");
  const dots = document.querySelectorAll(".premium-card-dot");
  if (!cardWrapper || !opportunityItems.length) return;

  const currentCard = cardWrapper.querySelector(".premium-opportunity-card");
  if (!currentCard) return;

  currentOpportunityIndex = newIndex;

  // Sync pagination dots
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === newIndex);
  });

  const gsap = window.gsap;
  if (gsap) {
    // 3D Flip Out
    gsap.to(currentCard, {
      rotateY: 90,
      opacity: 0,
      scale: 0.9,
      duration: 0.45,
      ease: "power2.in",
      onComplete: () => {
        cardWrapper.innerHTML = "";
        const newCard = createHomeOpportunityPreviewCard(opportunityItems[newIndex], isAuthenticated);
        
        // Initial state for 3D Flip In
        gsap.set(newCard, {
          rotateY: -90,
          opacity: 0,
          scale: 0.9
        });
        
        cardWrapper.appendChild(newCard);
        
        // 3D Flip In
        gsap.to(newCard, {
          rotateY: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          ease: "back.out(1.15)",
          clearProps: "transform"
        });
      }
    });
  } else {
    // Fallback if GSAP is unavailable
    cardWrapper.innerHTML = "";
    const newCard = createHomeOpportunityPreviewCard(opportunityItems[newIndex], isAuthenticated);
    cardWrapper.appendChild(newCard);
  }
}

function startOpportunityTimer(isAuthenticated) {
  stopOpportunityTimer();
  opportunityTimer = setInterval(() => {
    const nextIndex = (currentOpportunityIndex + 1) % opportunityItems.length;
    switchOpportunityCard(nextIndex, isAuthenticated);
  }, 10000); // 10 seconds
}

function stopOpportunityTimer() {
  if (opportunityTimer) {
    clearInterval(opportunityTimer);
    opportunityTimer = null;
  }
}

function syncHomeOpportunitiesCta(isAuthenticated) {
  const cta = document.querySelector("[data-home-opportunities-cta]");
  hideLegacyHomeOpportunitiesUi();
  document.body.dataset.homeAuthenticated = isAuthenticated ? "true" : "false";

  if (!cta) {
    return;
  }

  cta.href = isAuthenticated ? "/internships" : "/register";
  cta.dataset.transitionDirection = isAuthenticated ? "left" : "right";
}

async function initHomePageExperience() {
  if (!document.body.classList.contains("home-page")) {
    return;
  }

  hideLegacyHomeOpportunitiesUi();
  initHeroRoadmapGenerator();

  const navLogin = document.getElementById("homeNavLogin");
  const navDashboard = document.getElementById("homeNavDashboard");
  const navLogoutForm = document.getElementById("homeNavLogoutForm");
  const reviewGuestState = document.getElementById("homeReviewGuestState");
  const reviewForm = document.getElementById("homeReviewForm");
  const reviewLead = document.getElementById("homeReviewFormLead");
  const reviewSubmit = document.getElementById("homeReviewSubmit");
  const reviewsGrid = document.getElementById("homeReviewsGrid");

  try {
    const [homeStateResponse, reviewsResponse, previewResponse] = await Promise.all([
      fetch("/api/home-state", {
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
      fetch("/api/reviews", {
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
      fetch("/api/internships/preview?limit=5", {
        headers: { Accept: "application/json" },
      }),
    ]);

    const homeState = await homeStateResponse.json().catch(() => ({}));
    const reviewsPayload = await reviewsResponse.json().catch(() => ({}));
    const previewPayload = await previewResponse.json().catch(() => ({}));
    const isAuthenticated = Boolean(homeState && homeState.is_authenticated);
    const currentUser = homeState && homeState.user ? homeState.user : null;
    const publicReviews = Array.isArray(reviewsPayload.reviews) ? reviewsPayload.reviews : [];
    const previewItems = Array.isArray(previewPayload.items) ? previewPayload.items : [];

    syncHomeOpportunitiesCta(isAuthenticated);
    renderHomeOpportunityPreview(previewItems, isAuthenticated);

    if (navLogin) {
      navLogin.hidden = isAuthenticated;
    }

    if (navDashboard) {
      navDashboard.hidden = !isAuthenticated;
      navDashboard.textContent = "Кабинет";
    }

    if (navLogoutForm) {
      navLogoutForm.hidden = !isAuthenticated;
    }

    if (reviewGuestState) {
      reviewGuestState.hidden = isAuthenticated;
    }

    if (reviewForm) {
      reviewForm.hidden = !isAuthenticated;
    }

    if (reviewLead && isAuthenticated && currentUser) {
      reviewLead.textContent = currentUser.has_review
        ? "Ваш отзыв уже можно обновить. Расскажите, что изменилось сейчас и какой результат вы видите после использования платформы."
        : "Поделитесь, что изменилось после платформы: стало легче искать возможности, появился маршрут или удалось быстрее перейти к откликам.";
    }

    if (reviewSubmit && isAuthenticated) {
      reviewSubmit.textContent = currentUser && currentUser.has_review
        ? "Обновить отзыв"
        : "Опубликовать отзыв";
    }

    if (reviewsGrid && publicReviews.length) {
      reviewsGrid.innerHTML = "";
      publicReviews.forEach((review) => {
        reviewsGrid.appendChild(createReviewCard(review));
      });
    }

    initHomeAssistantExperience({
      isAuthenticated,
      currentUser,
    });

    showSmartRecommendationWidget({
      isAuthenticated,
      currentUser,
      homeState,
    });
  } catch (error) {
    console.error("Home page state error:", error);

    syncHomeOpportunitiesCta(false);
    renderHomeOpportunityPreview([], false);

    if (navLogin) {
      navLogin.hidden = false;
    }

    if (navDashboard) {
      navDashboard.hidden = true;
    }

    if (navLogoutForm) {
      navLogoutForm.hidden = true;
    }

    if (reviewGuestState) {
      reviewGuestState.hidden = false;
    }

    if (reviewForm) {
      reviewForm.hidden = true;
    }

    initHomeAssistantExperience({
      isAuthenticated: false,
      currentUser: null,
    });

    showSmartRecommendationWidget({
      isAuthenticated: false,
      currentUser: null,
      homeState: null,
    });
  }

  if (!reviewForm) {
    return;
  }

  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = document.getElementById("homeReviewSubmit");
    const cityInput = document.getElementById("homeReviewCity");
    const headlineInput = document.getElementById("homeReviewHeadline");
    const resultInput = document.getElementById("homeReviewResult");
    const bodyInput = document.getElementById("homeReviewBody");
    const reviewsGridNode = document.getElementById("homeReviewsGrid");

    if (!submitButton || !cityInput || !headlineInput || !resultInput || !bodyInput || !reviewsGridNode) {
      return;
    }

    submitButton.disabled = true;
    renderReviewStatus("Сохраняем отзыв...", "");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          city: cityInput.value,
          headline: headlineInput.value,
          result_summary: resultInput.value,
          body: bodyInput.value,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "Не удалось сохранить отзыв.");
      }

      const currentCards = Array.from(reviewsGridNode.querySelectorAll(".home-figma-review-card"));
      reviewsGridNode.innerHTML = "";
      reviewsGridNode.appendChild(createReviewCard(payload.review));

      currentCards.forEach((card) => {
        const existingHeadline = card.querySelector(".home-figma-review-headline");
        if (existingHeadline && payload.review && existingHeadline.textContent === payload.review.headline) {
          return;
        }
        if (reviewsGridNode.children.length < 6) {
          reviewsGridNode.appendChild(card);
        }
      });

      renderReviewStatus("Отзыв сохранён. Спасибо, это усиливает доверие к платформе.", "success");
      submitButton.textContent = "Обновить отзыв";
    } catch (error) {
      renderReviewStatus(error.message || "Не удалось сохранить отзыв.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

function showSmartRecommendationWidget({ isAuthenticated, currentUser, homeState }) {
  if (sessionStorage.getItem("kyd_smart_rec_dismissed") === "true") {
    return;
  }

  const suggestions = [];

  if (!isAuthenticated) {
    suggestions.push(
      {
        icon: "🚀",
        title: "Добро пожаловать в KazYouth!",
        text: "Создайте аккаунт, чтобы составить свой AI-маршрут к лучшим стажировкам и международным программам!",
        ctaText: "Зарегистрироваться сейчас →",
        ctaLink: "/register"
      },
      {
        icon: "🎙️",
        title: "AI Mock Interview",
        text: "Хей! Хотите проверить свои силы перед настоящим интервью? Пройдите пробное интервью с нашим ИИ.",
        ctaText: "Пройти AI Mock Interview →",
        ctaLink: "/login"
      },
      {
        icon: "📝",
        title: "Сделайте веб-резюме!",
        text: "Создайте стильное онлайн-резюме через наш Career Profile и делитесь им с работодателями.",
        ctaText: "Создать резюме →",
        ctaLink: "/register"
      },
      {
        icon: "💼",
        title: "Скрытый рынок вакансий",
        text: "Сотни проверенных зарубежных и локальных стажировок уже ждут вас на платформе.",
        ctaText: "Смотреть стажировки →",
        ctaLink: "/register"
      },
      {
        icon: "📚",
        title: "Полезные гайды и шаблоны",
        text: "Получите доступ к закрытой базе материалов по составлению CV и сопроводительных писем.",
        ctaText: "Изучить материалы →",
        ctaLink: "/register"
      }
    );
  } else {
    const hasProfileFilled = Boolean(currentUser && currentUser.first_name && currentUser.last_name);
    const hasPlusAccess = Boolean(homeState && homeState.has_plus_access);
    const firstName = currentUser && currentUser.first_name ? currentUser.first_name : "";
    const emailPrefix = currentUser && currentUser.email ? currentUser.email.split("@")[0] : "Пользователь";

    if (!hasProfileFilled) {
      suggestions.push({
        icon: "📝",
        title: "Заполните ваш профиль!",
        text: `Хей, ${emailPrefix}! Заполните профиль в Career Profile, чтобы работодатели могли найти вас, и приступайте к работе!`,
        ctaText: "Заполнить профиль →",
        ctaLink: "/career-profile"
      });
    }

    suggestions.push({
      icon: "🎙️",
      title: "Пройдите Mock Interview!",
      text: "Попробуйте наше AI-интервью! ИИ задаст вопросы по вашей специальности и даст подробный фидбек.",
      ctaText: "Начать AI-интервью →",
      ctaLink: "/interview"
    });

    if (!hasPlusAccess) {
      suggestions.push({
        icon: "💎",
        title: "Подключите Plus!",
        text: `Хей, ${firstName || emailPrefix}! Откройте безлимитный доступ ко всем стажировкам и уникальным грантам.`,
        ctaText: "Подключить Plus →",
        ctaLink: "/subscribe"
      });
    }

    suggestions.push({
      icon: "🔗",
      title: "Поделитесь профилем!",
      text: "Вы можете сделать ваш Career Profile публичным и отправлять ссылку рекрутерам.",
      ctaText: "Настроить видимость →",
      ctaLink: "/career-profile"
    });

    suggestions.push({
      icon: "⏰",
      title: "Следите за дедлайнами!",
      text: "Добавляйте интересные стажировки в избранное в Кабинете, чтобы не упустить сроки подачи.",
      ctaText: "В личный кабинет →",
      ctaLink: "/dashboard"
    });

    suggestions.push({
      icon: "📖",
      title: "Прокачайте сопроводительное!",
      text: "Загляните в раздел 'Материалы', там лежат успешные шаблоны писем в топовые компании.",
      ctaText: "Читать материалы →",
      ctaLink: "/resources"
    });
  }

  if (suggestions.length === 0) {
    return;
  }

  let currentIndex = 0;
  let rotationIntervalId = null;

  window.setTimeout(() => {
    if (sessionStorage.getItem("kyd_smart_rec_dismissed") === "true") {
      return;
    }

    const oldWidget = document.getElementById("smartRecWidget");
    if (oldWidget) {
      oldWidget.remove();
    }

    const widget = document.createElement("div");
    widget.className = "smart-rec-widget";
    widget.id = "smartRecWidget";
    
    const firstItem = suggestions[currentIndex];
    widget.innerHTML = `
      <button class="smart-rec-close" id="smartRecClose" aria-label="Закрыть">×</button>
      <div class="smart-rec-icon">${firstItem.icon}</div>
      <div class="smart-rec-content">
        <h4 class="smart-rec-title">${firstItem.title}</h4>
        <p class="smart-rec-text">${firstItem.text}</p>
        <a href="${firstItem.ctaLink}" class="smart-rec-cta">${firstItem.ctaText}</a>
      </div>
    `;

    document.body.appendChild(widget);

    function stopRotation() {
      if (rotationIntervalId) {
        clearInterval(rotationIntervalId);
        rotationIntervalId = null;
      }
    }

    const closeBtn = widget.querySelector("#smartRecClose");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        stopRotation();
        widget.classList.add("dismissing");
        sessionStorage.setItem("kyd_smart_rec_dismissed", "true");
        window.setTimeout(() => {
          widget.remove();
        }, 400);
      });
    }

    const ctaLinkEl = widget.querySelector(".smart-rec-cta");
    if (ctaLinkEl) {
      ctaLinkEl.addEventListener("click", () => {
        stopRotation();
        widget.classList.add("dismissing");
        window.setTimeout(() => {
          widget.remove();
        }, 400);
      });
    }

    function rotateToNext() {
      if (sessionStorage.getItem("kyd_smart_rec_dismissed") === "true") {
        stopRotation();
        widget.remove();
        return;
      }

      currentIndex = (currentIndex + 1) % suggestions.length;
      const nextItem = suggestions[currentIndex];

      widget.classList.add("changing");

      window.setTimeout(() => {
        if (!document.getElementById("smartRecWidget")) {
          stopRotation();
          return;
        }

        const iconNode = widget.querySelector(".smart-rec-icon");
        const titleNode = widget.querySelector(".smart-rec-title");
        const textNode = widget.querySelector(".smart-rec-text");
        const ctaNode = widget.querySelector(".smart-rec-cta");

        if (iconNode) iconNode.textContent = nextItem.icon;
        if (titleNode) titleNode.textContent = nextItem.title;
        if (textNode) textNode.textContent = nextItem.text;
        if (ctaNode) {
          ctaNode.textContent = nextItem.ctaText;
          ctaNode.setAttribute("href", nextItem.ctaLink);
        }

        widget.classList.remove("changing");
      }, 400);
    }

    rotationIntervalId = setInterval(rotateToNext, 7000);
  }, 3500);
}

function initHeroRoadmapGenerator() {
  const container = document.getElementById("interactiveRoadmapContainer");
  if (!container) return;

  const lang = localStorage.getItem("kyd_lang") || "ru";

  const tDict = {
    ru: {
      selTitle: "Выберите направление для генерации AI-маршрута:",
      optIT: "💻 IT & Разработка",
      optBiz: "💼 Бизнес & Маркетинг",
      optSci: "🧪 Наука & Аналитика",
      resetBtn: "Сгенерировать другой маршрут ↺",
      generatedLabel: "AI-маршрут успешно построен",
      loadingText: [
        "ИИ анализирует требования...",
        "Подбираем этапы отбора...",
        "Формируем персональный Roadmap..."
      ],
      itSteps: [
        "Оформить резюме и собрать 2-3 учебных проекта на GitHub",
        "Найти оплачиваемые стажировки в локальных IT-компаниях и банках",
        "Пройти тренировку технического и поведенческого интервью с ИИ"
      ],
      bizSteps: [
        "Описать кейсы участия в кейс-чемпионатах или студенческих проектах",
        "Отобрать вакансии начального уровня (Junior/Intern) в маркетинге или продажах",
        "Пройти симуляцию собеседования по компетенциям и кейс-интервью с ИИ"
      ],
      sciSteps: [
        "Оформить резюме исследователя, выделив курсовые работы и публикации",
        "Найти подходящие научно-исследовательские лаборатории или стажировки",
        "Составить сильное мотивационное письмо и отрепетировать защиту проекта с ИИ"
      ]
    },
    en: {
      selTitle: "Select direction to generate AI Roadmap:",
      optIT: "💻 IT & Development",
      optBiz: "💼 Business & Marketing",
      optSci: "🧪 Science & Analytics",
      resetBtn: "Generate another roadmap ↺",
      generatedLabel: "AI Roadmap successfully generated",
      loadingText: [
        "AI is analyzing requirements...",
        "Matching selection stages...",
        "Building your personalized Roadmap..."
      ],
      itSteps: [
        "Build a clean resume and host 2-3 active projects on GitHub",
        "Find paid internships in local tech companies, startups, or banks",
        "Practice coding, system design, or tech Q&A with our AI mentor"
      ],
      bizSteps: [
        "Highlight case-championship experience and format your CV",
        "Select entry-level positions (Intern/Junior) in marketing, analytics, or sales",
        "Practice competency-based questions and case solving with AI"
      ],
      sciSteps: [
        "Format academic CV and structure your research papers",
        "Find research laboratories, assistantships, or grants",
        "Draft motivation letters and prep for interviews using AI"
      ]
    },
    kk: {
      selTitle: "AI-маршрутты жасау үшін бағытты таңдаңыз:",
      optIT: "💻 IT & Әзірлеу",
      optBiz: "💼 Бизнес & Маркетинг",
      optSci: "🧪 Ғылым & Аналитика",
      resetBtn: "Басқасын жасау ↺",
      generatedLabel: "AI-маршрут сәтті жасалды",
      loadingText: [
        "ИИ талаптарды талдауда...",
        "Іріктеу кезеңдерін сәйкестендіру...",
        "Жеке Roadmap құрастыру..."
      ],
      itSteps: [
        "Сапалы түйіндеме жасау және GitHub-та 2-3 оқу жобасын жинақтау",
        "Жергілікті IT-компаниялар мен технологиялық банктерден ақылы тағылымдамаларды табу",
        "ИИ-ментормен техникалық және мінез-құлық сұхбатынан өтуді жаттықтыру"
      ],
      bizSteps: [
        "Кейс-чемпионаттарға немесе студенттік жобаларға қатысу тәжірибесін сипаттау",
        "Маркетинг, талдау немесе сату салаларындағы бастапқы деңгейдегі (Intern/Junior) бос орындарды іріктеу",
        "ИИ көмегімен құзыреттілік сұхбатына және кейс шешуге дайындалу"
      ],
      sciSteps: [
        "Курстық жұмыстар мен ғылыми жарияланымдарды атап өтіп, зерттеуші резюмесін рәсімдеу",
        "Сәйкес келетін ғылыми-зерттеу зертханаларын немесе тағылымдамаларды табу",
        "Сапалы уәждемелік хат дайындау және ИИ-мен бірге жобаны қорғауды жаттықтыру"
      ]
    }
  };

  const texts = tDict[lang] || tDict.ru;

  function renderSelectionScreen() {
    container.innerHTML = `
      <div class="roadmap-selection-screen">
        <span class="roadmap-selection-title">${texts.selTitle}</span>
        <button class="roadmap-option-btn" data-roadmap-choice="it">
          <span>${texts.optIT}</span>
          <span class="arrow-icon">→</span>
        </button>
        <button class="roadmap-option-btn" data-roadmap-choice="biz">
          <span>${texts.optBiz}</span>
          <span class="arrow-icon">→</span>
        </button>
        <button class="roadmap-option-btn" data-roadmap-choice="sci">
          <span>${texts.optSci}</span>
          <span class="arrow-icon">→</span>
        </button>
      </div>
    `;

    container.querySelectorAll("[data-roadmap-choice]").forEach(btn => {
      btn.addEventListener("click", () => {
        const choice = btn.getAttribute("data-roadmap-choice");
        renderLoadingScreen(choice);
      });
    });
  }

  function renderLoadingScreen(choice) {
    container.innerHTML = `
      <div class="roadmap-loading-screen">
        <div class="roadmap-spinner">
          <span class="roadmap-spinner-circle"></span>
        </div>
        <div class="roadmap-loading-text" id="roadmapLoadingText">${texts.loadingText[0]}</div>
      </div>
    `;

    const loadingTextNode = container.querySelector("#roadmapLoadingText");

    let step = 1;
    const interval = setInterval(() => {
      if (loadingTextNode && texts.loadingText[step]) {
        loadingTextNode.textContent = texts.loadingText[step];
        step++;
      }
    }, 600);

    setTimeout(() => {
      clearInterval(interval);
      renderResultsScreen(choice);
    }, 1800);
  }

  function renderResultsScreen(choice) {
    let steps = [];
    if (choice === "it") steps = texts.itSteps;
    else if (choice === "biz") steps = texts.bizSteps;
    else steps = texts.sciSteps;

    container.innerHTML = `
      <div class="roadmap-results-screen">
        <ol class="career-gps-list">
          <li>
            <span class="career-gps-icon" aria-hidden="true"></span>
            <span>${steps[0]}</span>
          </li>
          <li>
            <span class="career-gps-icon" aria-hidden="true"></span>
            <span>${steps[1]}</span>
          </li>
          <li>
            <span class="career-gps-icon" aria-hidden="true"></span>
            <span>${steps[2]}</span>
          </li>
        </ol>

        <div class="career-gps-status">
          <span aria-hidden="true" class="pulse-dot"></span>
          <span>${texts.generatedLabel}</span>
        </div>

        <button class="roadmap-reset-btn" id="roadmapResetBtn">
          <span>${texts.resetBtn}</span>
        </button>
      </div>
    `;

    container.querySelector("#roadmapResetBtn").addEventListener("click", () => {
      renderSelectionScreen();
    });
  }

  renderSelectionScreen();
}

async function initYouthPageExperience() {
  if (!document.body.classList.contains("youth-page")) {
    return;
  }

  const navLogin = document.getElementById("homeNavLogin");
  const navDashboard = document.getElementById("homeNavDashboard");
  const navLogoutForm = document.getElementById("homeNavLogoutForm");

  try {
    const response = await fetch("/api/home-state", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    const homeState = await response.json().catch(() => ({}));
    const isAuthenticated = Boolean(homeState && homeState.is_authenticated);
    const currentUser = homeState && homeState.user ? homeState.user : null;

    if (navLogin) navLogin.hidden = isAuthenticated;
    if (navDashboard) navDashboard.hidden = !isAuthenticated;
    if (navLogoutForm) navLogoutForm.hidden = !isAuthenticated;

    initHomeAssistantExperience({ isAuthenticated, currentUser });
  } catch (_error) {
    if (navLogin) navLogin.hidden = false;
    if (navDashboard) navDashboard.hidden = true;
    if (navLogoutForm) navLogoutForm.hidden = true;
    initHomeAssistantExperience({ isAuthenticated: false, currentUser: null });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("youth-page")) {
    void initYouthPageExperience();
  } else {
    void initHomePageExperience();
  }
});

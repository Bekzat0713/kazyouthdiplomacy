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

    if (hasFreshRouteTransition) {
      splash.remove();
      document.body.classList.add("splash-finished");
      return;
    }

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
});

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
    state.input.disabled = sending || !state.enabled;
  }

  if (state.submit) {
    state.submit.disabled = sending || !state.enabled;
    state.submit.textContent = sending ? "AI Youth думает..." : "Спросить AI Youth";
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
    setHomeAiStatus(state, "AI Youth временно недоступен. Попробуйте еще раз чуть позже.", "warning");
  } finally {
    setHomeAiSending(state, false);
  }
}

function askHomeAiGuestQuestion(state, question) {
  const answer = HOME_AI_GUEST_ANSWERS[question];
  if (!answer) {
    pushHomeAiMessage(
      state,
      "assistant",
      "Сейчас я могу быстро рассказать про сайт, пользу платформы и стартовые шаги. Для живого диалога войдите в аккаунт."
    );
    setHomeAiStatus(state, "Для персонального ответа войдите в аккаунт или начните с Career GPS.", "warning");
    return;
  }

  pushHomeAiMessage(state, "user", question);
  pushHomeAiMessage(state, "assistant", answer);
  setHomeAiStatus(state, "Быстрый ответ открыт. Для персональных рекомендаций войдите в аккаунт.", "");
}

async function submitHomeAiPrompt(state, promptText) {
  const text = String(promptText || "").trim();
  if (!text) {
    return;
  }

  if (!state.enabled) {
    pushHomeAiMessage(
      state,
      "assistant",
      "Для живого диалога с AI Youth нужен вход в аккаунт. Пока можно начать с готовых вопросов выше или пройти Career GPS опрос."
    );
    setHomeAiStatus(state, "Войдите в аккаунт, чтобы AI Youth дал персональный ответ.", "warning");
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
    pushHomeAiMessage(
      state,
      "assistant",
      "Сервис AI Youth сейчас временно недоступен. Попробуйте еще раз чуть позже."
    );
    setHomeAiStatus(state, "", "");
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
        ? "Я AI Youth на главной странице. Могу объяснить, чем полезен сайт, с чего начать и куда вам лучше двигаться дальше."
        : "Я AI Youth на главной странице. Ниже есть быстрые вопросы про сайт, пользу платформы и первые шаги. Для персонального диалога войдите в аккаунт."
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
    hint.textContent = "Можно спросить про сайт, карьерный путь, доступ, стажировки и следующий шаг.";
    setHomeAiStatus(state, "Проверяю доступность AI Youth...", "");
    void fetchHomeAiAvailability(state);
  } else {
    modeBadge.textContent = "Быстрые ответы";
    hint.textContent = "Для персональных ответов войдите в аккаунт. Пока можно начать с быстрых вопросов выше.";
    input.disabled = true;
    submit.disabled = true;
    setHomeAiStatus(state, "AI Youth уже под рукой: начните с готовых вопросов, а для персонального диалога войдите в аккаунт.", "");
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

async function initHomePageExperience() {
  if (!document.body.classList.contains("home-page")) {
    return;
  }

  const navLogin = document.getElementById("homeNavLogin");
  const navDashboard = document.getElementById("homeNavDashboard");
  const navLogoutForm = document.getElementById("homeNavLogoutForm");
  const reviewGuestState = document.getElementById("homeReviewGuestState");
  const reviewForm = document.getElementById("homeReviewForm");
  const reviewLead = document.getElementById("homeReviewFormLead");
  const reviewSubmit = document.getElementById("homeReviewSubmit");
  const reviewsGrid = document.getElementById("homeReviewsGrid");

  try {
    const [homeStateResponse, reviewsResponse] = await Promise.all([
      fetch("/api/home-state", {
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
      fetch("/api/reviews", {
        credentials: "include",
        headers: { Accept: "application/json" },
      }),
    ]);

    const homeState = await homeStateResponse.json().catch(() => ({}));
    const reviewsPayload = await reviewsResponse.json().catch(() => ({}));
    const isAuthenticated = Boolean(homeState && homeState.is_authenticated);
    const currentUser = homeState && homeState.user ? homeState.user : null;
    const publicReviews = Array.isArray(reviewsPayload.reviews) ? reviewsPayload.reviews : [];

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
  } catch (error) {
    console.error("Home page state error:", error);

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

document.addEventListener("DOMContentLoaded", () => {
  void initHomePageExperience();
});

const analyticsStatus = document.getElementById("adminAnalyticsStatus");
const analyticsGeneratedAt = document.getElementById("adminAnalyticsGeneratedAt");
const analyticsOverview = document.getElementById("adminAnalyticsOverview");
const analyticsGoals = document.getElementById("adminAnalyticsGoals");
const analyticsCurrentStatuses = document.getElementById("adminAnalyticsCurrentStatuses");
const analyticsSubscriptions = document.getElementById("adminAnalyticsSubscriptions");
const analyticsRecentUsers = document.getElementById("adminAnalyticsRecentUsers");

function setAnalyticsStatus(message, isError = false) {
  if (!analyticsStatus) {
    return;
  }

  analyticsStatus.textContent = message;
  analyticsStatus.classList.toggle("error", Boolean(message) && isError);
  analyticsStatus.classList.toggle("success", Boolean(message) && !isError);
}

function formatDateTime(value) {
  if (!value) {
    return "Не указано";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU");
}

function formatPercent(value) {
  return `${Number(value || 0)}%`;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function renderOverview(overview) {
  if (!analyticsOverview) {
    return;
  }

  const cards = [
    {
      label: "Всего пользователей",
      value: overview.users_total,
      detail: `За 7 дней: ${overview.registrations_last_7d}, за 30 дней: ${overview.registrations_last_30d}`,
    },
    {
      label: "Подтвердили почту",
      value: overview.verified_users,
      detail: `Конверсия: ${formatPercent(overview.verification_rate)}`,
    },
    {
      label: "Анкету заполнили",
      value: overview.survey_completed_users,
      detail: `Конверсия: ${formatPercent(overview.survey_completion_rate)}`,
    },
    {
      label: "Активный Plus",
      value: overview.active_plus_users,
      detail: `Конверсия: ${formatPercent(overview.plus_conversion_rate)}`,
    },
    {
      label: "Ждут проверки оплаты",
      value: overview.pending_payment_users,
      detail: `Отклонено: ${overview.rejected_payments}, истекло: ${overview.expired_plus_users}`,
    },
    {
      label: "Работают на Free",
      value: overview.free_users,
      detail: `Без подтверждения почты: ${overview.unverified_users}`,
    },
    {
      label: "Есть сохранения",
      value: overview.users_with_saved_items,
      detail: `Всего сохранений: ${overview.saved_items_total}`,
    },
    {
      label: "Активные тарифы",
      value: `${overview.active_monthly_users}/${overview.active_quarterly_users}/${overview.active_halfyear_users}`,
      detail: "1 мес / 3 мес / 6 мес",
    },
  ];

  analyticsOverview.innerHTML = "";
  const fragment = document.createDocumentFragment();

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "admin-analytics-metric";
    article.appendChild(createTextElement("span", "admin-analytics-label", card.label));
    article.appendChild(createTextElement("strong", "admin-analytics-value", String(card.value)));
    article.appendChild(createTextElement("p", "admin-analytics-detail", card.detail));
    fragment.appendChild(article);
  });

  analyticsOverview.appendChild(fragment);
}

function renderBreakdown(container, items) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!items.length) {
    container.appendChild(createTextElement("p", "admin-analytics-empty", "Пока нет данных."));
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-analytics-list-row";

    const info = document.createElement("div");
    info.className = "admin-analytics-list-info";
    info.appendChild(createTextElement("strong", "", item.label || item.key || "Без названия"));
    info.appendChild(createTextElement("span", "", `${item.total} пользователей`));

    const count = createTextElement("span", "admin-analytics-list-count", String(item.total));

    row.appendChild(info);
    row.appendChild(count);
    fragment.appendChild(row);
  });

  container.appendChild(fragment);
}

function renderSubscriptionBreakdown(items) {
  if (!analyticsSubscriptions) {
    return;
  }

  analyticsSubscriptions.innerHTML = "";

  if (!items.length) {
    analyticsSubscriptions.appendChild(createTextElement("p", "admin-analytics-empty", "Пока нет подписок."));
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-analytics-subscription-card";

    const title = `${item.status === "none" ? "Без подписки" : item.status}${item.plan && item.plan !== "none" ? ` • ${item.plan}` : ""}`;
    card.appendChild(createTextElement("strong", "", title));
    card.appendChild(createTextElement("p", "", `${item.total} пользователей`));
    fragment.appendChild(card);
  });

  analyticsSubscriptions.appendChild(fragment);
}

function renderRecentUsers(items) {
  if (!analyticsRecentUsers) {
    return;
  }

  analyticsRecentUsers.innerHTML = "";

  if (!items.length) {
    analyticsRecentUsers.appendChild(createTextElement("p", "admin-analytics-empty", "Пока нет регистраций."));
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((user) => {
    const card = document.createElement("article");
    card.className = "admin-analytics-user-card";

    const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
    card.appendChild(createTextElement("h4", "", name));
    card.appendChild(createTextElement("p", "admin-analytics-user-email", user.email));

    const meta = document.createElement("div");
    meta.className = "admin-analytics-user-meta";
    meta.appendChild(createTextElement("span", "", `Регистрация: ${formatDateTime(user.created_at)}`));
    meta.appendChild(createTextElement("span", "", user.is_verified ? "Почта подтверждена" : "Почта не подтверждена"));
    meta.appendChild(createTextElement("span", "", user.main_goal ? `Цель: ${user.main_goal.label}` : "Цель не указана"));
    meta.appendChild(createTextElement("span", "", user.current_status ? `Статус: ${user.current_status.label}` : "Статус не указан"));
    meta.appendChild(
      createTextElement(
        "span",
        "",
        user.subscription
          ? `Подписка: ${user.subscription.status}${user.subscription.plan ? ` • ${user.subscription.plan}` : ""}`
          : "Подписки нет"
      )
    );

    if (user.subscription && user.subscription.expires_at) {
      meta.appendChild(createTextElement("span", "", `Действует до: ${formatDateTime(user.subscription.expires_at)}`));
    }

    card.appendChild(meta);
    fragment.appendChild(card);
  });

  analyticsRecentUsers.appendChild(fragment);
}

async function loadAdminAnalytics() {
  setAnalyticsStatus("Загружаем аналитику...");

  try {
    const response = await fetch("/api/admin-analytics", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить аналитику.");
    }

    renderOverview(payload.overview || {});
    renderBreakdown(analyticsGoals, Array.isArray(payload.goal_breakdown) ? payload.goal_breakdown : []);
    renderBreakdown(analyticsCurrentStatuses, Array.isArray(payload.current_status_breakdown) ? payload.current_status_breakdown : []);
    renderSubscriptionBreakdown(Array.isArray(payload.subscription_breakdown) ? payload.subscription_breakdown : []);
    renderRecentUsers(Array.isArray(payload.recent_users) ? payload.recent_users : []);

    if (analyticsGeneratedAt) {
      analyticsGeneratedAt.textContent = `Обновлено: ${formatDateTime(payload.generated_at)}`;
    }

    setAnalyticsStatus("");
  } catch (error) {
    setAnalyticsStatus(error.message || "Не удалось загрузить аналитику.", true);
    console.error("Admin analytics load error:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadAdminAnalytics();
  window.setInterval(() => {
    void loadAdminAnalytics();
  }, 30000);
});

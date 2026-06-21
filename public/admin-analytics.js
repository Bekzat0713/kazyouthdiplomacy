const analyticsStatus = document.getElementById("adminAnalyticsStatus");
const analyticsGeneratedAt = document.getElementById("adminAnalyticsGeneratedAt");
const analyticsOverview = document.getElementById("adminAnalyticsOverview");
const analyticsGoals = document.getElementById("adminAnalyticsGoals");
const analyticsCurrentStatuses = document.getElementById("adminAnalyticsCurrentStatuses");
const analyticsSubscriptions = document.getElementById("adminAnalyticsSubscriptions");

let dynamicsChart = null;
let subscriptionChart = null;
let goalsChart = null;
let statusesChart = null;
let rawDynamicsData = [];

// All Users Search & Pagination state
let currentSearchQuery = "";
let usersOffset = 0;
const usersLimit = 20;

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

// --- Chart.js Initializations & Updates ---

function updateDynamicsChart(dynamics, days = 30) {
  const canvas = document.getElementById("registrationDynamicsChart");
  if (!canvas || typeof Chart === "undefined") return;

  const today = new Date();
  const labels = [];
  const dataPoints = [];
  const dynamicsMap = new Map(dynamics.map((d) => [d.date_str, d.total]));

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }));
    dataPoints.push(dynamicsMap.get(dateStr) || 0);
  }

  if (dynamicsChart) {
    dynamicsChart.data.labels = labels;
    dynamicsChart.data.datasets[0].data = dataPoints;
    dynamicsChart.update();
    return;
  }

  const ctx = canvas.getContext("2d");
  dynamicsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Регистрации",
          data: dataPoints,
          borderColor: "#1a2332",
          backgroundColor: "rgba(26, 35, 50, 0.05)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

function updateSubscriptionChart(overview) {
  const canvas = document.getElementById("subscriptionPlansChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = ["1 месяц", "3 месяца", "6 месяцев"];
  const dataPoints = [
    overview.active_monthly_users || 0,
    overview.active_quarterly_users || 0,
    overview.active_halfyear_users || 0,
  ];

  if (subscriptionChart) {
    subscriptionChart.data.datasets[0].data = dataPoints;
    subscriptionChart.update();
    return;
  }

  const ctx = canvas.getContext("2d");
  subscriptionChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          data: dataPoints,
          backgroundColor: ["#3b82f6", "#10b981", "#8b5cf6"],
          borderWidth: 0,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

function updateGoalsChart(goals) {
  const canvas = document.getElementById("goalsChart");
  if (!canvas || typeof Chart === "undefined") return;

  const sorted = [...goals].sort((a, b) => b.total - a.total);
  const labels = sorted.map((g) => g.label);
  const dataPoints = sorted.map((g) => g.total);

  if (goalsChart) {
    goalsChart.data.labels = labels;
    goalsChart.data.datasets[0].data = dataPoints;
    goalsChart.update();
    return;
  }

  const ctx = canvas.getContext("2d");
  goalsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: dataPoints,
          backgroundColor: ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 10 } },
        },
      },
    },
  });
}

function updateStatusesChart(statuses) {
  const canvas = document.getElementById("statusesChart");
  if (!canvas || typeof Chart === "undefined") return;

  const labels = statuses.map((s) => s.label);
  const dataPoints = statuses.map((s) => s.total);

  if (statusesChart) {
    statusesChart.data.labels = labels;
    statusesChart.data.datasets[0].data = dataPoints;
    statusesChart.update();
    return;
  }

  const ctx = canvas.getContext("2d");
  statusesChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: dataPoints,
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#64748b"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 10 } },
        },
      },
    },
  });
}

function initTimeframeSelector() {
  const container = document.querySelector(".chart-timeframe-selector");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".chart-time-btn");
    if (!btn) return;

    container.querySelectorAll(".chart-time-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const days = parseInt(btn.dataset.days, 10);
    updateDynamicsChart(rawDynamicsData, days);
  });
}

// --- All Users Operations ---

async function cancelSubscription(subscriptionId, userEmail) {
  const confirmed = confirm(`Вы действительно хотите принудительно отменить Plus подписку для пользователя ${userEmail}?`);
  if (!confirmed) return;

  setAnalyticsStatus("Отменяем подписку...");

  try {
    const response = await fetch(`/api/admin/subscription/${subscriptionId}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось отменить подписку.");
    }
    setAnalyticsStatus("");
    alert("Подписка успешно отменена.");
    // Refresh both dashboard summary and user list
    void loadAdminAnalytics();
    void searchUsers(false);
  } catch (err) {
    setAnalyticsStatus(err.message, true);
    alert(err.message);
  }
}

function renderUsersList(users, append = false) {
  const container = document.getElementById("adminAllUsersList");
  if (!container) return;

  if (!append) {
    container.innerHTML = "";
  }

  if (!users.length && !append) {
    container.innerHTML = '<p class="admin-analytics-empty">Пользователи не найдены.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  users.forEach((user) => {
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

    const subText = user.subscription
      ? `Подписка: ${user.subscription.status}${user.subscription.plan ? ` • ${user.subscription.plan}` : ""}`
      : "Подписки нет";
    meta.appendChild(createTextElement("span", "", subText));

    if (user.subscription && user.subscription.expires_at) {
      meta.appendChild(createTextElement("span", "", `Действует до: ${formatDateTime(user.subscription.expires_at)}`));
    }

    card.appendChild(meta);

    // If subscription is active, show the cancel button
    if (user.subscription && user.subscription.active) {
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "admin-cancel-sub-btn";
      cancelBtn.textContent = "Отменить подписку";
      cancelBtn.addEventListener("click", () => {
        void cancelSubscription(user.subscription.id, user.email);
      });
      card.appendChild(cancelBtn);
    }

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

async function searchUsers(append = false) {
  const searchInput = document.getElementById("adminUserSearchInput");
  const query = searchInput ? searchInput.value.trim() : "";

  if (!append) {
    usersOffset = 0;
    currentSearchQuery = query;
  }

  try {
    const response = await fetch(`/api/admin/users?q=${encodeURIComponent(currentSearchQuery)}&limit=${usersLimit}&offset=${usersOffset}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить пользователей.");
    }

    renderUsersList(payload.users, append);

    const loadMoreContainer = document.getElementById("adminUsersLoadMoreContainer");
    if (loadMoreContainer) {
      const shownSoFar = usersOffset + payload.users.length;
      if (shownSoFar < payload.total) {
        loadMoreContainer.style.display = "flex";
      } else {
        loadMoreContainer.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Search users error:", err);
  }
}

function initUserSearch() {
  const searchBtn = document.getElementById("adminUserSearchBtn");
  const searchInput = document.getElementById("adminUserSearchInput");
  const loadMoreBtn = document.getElementById("adminUsersLoadMoreBtn");

  if (searchBtn) {
    searchBtn.addEventListener("click", () => searchUsers(false));
  }
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        searchUsers(false);
      }
    });
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      usersOffset += usersLimit;
      searchUsers(true);
    });
  }

  // Load initial list of users
  void searchUsers(false);
}

// --- Subscribers Tab ---

let currentSubsPlan = "";
let currentSubsQuery = "";
let subsOffset = 0;
const subsLimit = 20;
let subscribersTabLoaded = false;

const PLAN_LABELS = {
  monthly: "Месяц",
  quarterly: "3 Месяца",
  halfyear: "Полгода",
};

function getPlanBadgeHtml(plan) {
  const label = PLAN_LABELS[plan] || plan || "—";
  const cls = plan || "unknown";
  return `<span class="sub-plan-badge ${cls}">${label}</span>`;
}

function renderSubscribersList(subscribers, append = false) {
  const container = document.getElementById("subscribersList");
  if (!container) return;

  if (!append) {
    container.innerHTML = "";
  }

  if (!subscribers.length && !append) {
    container.innerHTML = '<p class="admin-analytics-empty">Подписчиков не найдено.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  subscribers.forEach((sub) => {
    const card = document.createElement("div");
    card.className = "subscriber-card";
    card.id = `subscriber-${sub.subscription.id}`;

    const name = [sub.first_name, sub.last_name].filter(Boolean).join(" ").trim() || sub.email;
    const expiresText = sub.subscription.expires_at ? formatDateTime(sub.subscription.expires_at) : "Не указано";
    const createdText = sub.subscription.created_at ? formatDateTime(sub.subscription.created_at) : formatDateTime(sub.created_at);

    card.innerHTML = `
      <div class="subscriber-info">
        <h4>${escapeHtml(name)}</h4>
        <p class="subscriber-email">${escapeHtml(sub.email)}</p>
        <div class="subscriber-meta-row">
          ${getPlanBadgeHtml(sub.subscription.plan)}
          <span>📅 Подписка до: ${expiresText}</span>
          <span>🕐 Оформлена: ${createdText}</span>
        </div>
      </div>
      <div class="subscriber-actions"></div>
    `;

    // Add deactivate button
    const actionsDiv = card.querySelector(".subscriber-actions");
    const deactivateBtn = document.createElement("button");
    deactivateBtn.className = "admin-deactivate-btn";
    deactivateBtn.textContent = "Деактивировать";
    deactivateBtn.addEventListener("click", () => {
      void deactivateSubscription(sub.subscription.id, sub.email);
    });
    actionsDiv.appendChild(deactivateBtn);

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function deactivateSubscription(subscriptionId, userEmail) {
  const confirmed = confirm(`Вы действительно хотите деактивировать подписку для ${userEmail}?`);
  if (!confirmed) return;

  setAnalyticsStatus("Деактивируем подписку...");

  try {
    const response = await fetch(`/api/admin/subscription/${subscriptionId}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось деактивировать подписку.");
    }
    setAnalyticsStatus("");
    alert("Подписка успешно деактивирована.");
    // Refresh subscribers list and analytics
    void loadSubscribers(false);
    void loadAdminAnalytics();
  } catch (err) {
    setAnalyticsStatus(err.message, true);
    alert(err.message);
  }
}

async function loadSubscribers(append = false) {
  const container = document.getElementById("subscribersList");

  if (!append) {
    subsOffset = 0;
    if (container) {
      container.innerHTML = '<p class="admin-analytics-empty" style="color: #94a3b8;">Загружаем подписчиков...</p>';
    }
  }

  try {
    const params = new URLSearchParams({
      plan: currentSubsPlan,
      q: currentSubsQuery,
      limit: subsLimit,
      offset: subsOffset,
    });
    const response = await fetch(`/api/admin/subscribers?${params.toString()}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить подписчиков.");
    }

    renderSubscribersList(payload.subscribers, append);

    // Update total badge
    const totalBadge = document.getElementById("subsTotalBadge");
    if (totalBadge) {
      totalBadge.style.display = "inline-flex";
      const planLabel = currentSubsPlan ? PLAN_LABELS[currentSubsPlan] : "Все тарифы";
      totalBadge.innerHTML = `${planLabel}: <strong>${payload.total}</strong> активных подписчиков`;
    }

    // Load more button
    const loadMoreContainer = document.getElementById("subsLoadMoreContainer");
    if (loadMoreContainer) {
      const shownSoFar = subsOffset + payload.subscribers.length;
      loadMoreContainer.style.display = shownSoFar < payload.total ? "flex" : "none";
    }
  } catch (err) {
    console.error("Load subscribers error:", err);
    if (container && !append) {
      container.innerHTML = `<p class="admin-analytics-empty" style="color: #ef4444;">${err.message}</p>`;
    }
  }
}

function initTabSwitcher() {
  const tabContainer = document.querySelector(".admin-tabs");
  if (!tabContainer) return;

  tabContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".admin-tab-btn");
    if (!btn) return;

    const tabId = btn.dataset.tab;

    // Toggle active tab button
    tabContainer.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Toggle active tab content
    document.querySelectorAll(".admin-tab-content").forEach((panel) => panel.classList.remove("active"));
    const targetPanel = document.getElementById(tabId === "analytics" ? "tabAnalytics" : "tabSubscribers");
    if (targetPanel) {
      targetPanel.classList.add("active");
    }

    // Lazy-load subscribers on first tab switch
    if (tabId === "subscribers" && !subscribersTabLoaded) {
      subscribersTabLoaded = true;
      void loadSubscribers(false);
    }
  });
}

function initSubscribersTab() {
  // Plan filter buttons
  const filtersContainer = document.getElementById("subsPlanFilters");
  if (filtersContainer) {
    filtersContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".subs-plan-btn");
      if (!btn) return;

      filtersContainer.querySelectorAll(".subs-plan-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      currentSubsPlan = btn.dataset.plan || "";
      void loadSubscribers(false);
    });
  }

  // Search
  const searchBtn = document.getElementById("subsSearchBtn");
  const searchInput = document.getElementById("subsSearchInput");

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      currentSubsQuery = searchInput ? searchInput.value.trim() : "";
      void loadSubscribers(false);
    });
  }
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        currentSubsQuery = searchInput.value.trim();
        void loadSubscribers(false);
      }
    });
  }

  // Load more
  const loadMoreBtn = document.getElementById("subsLoadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      subsOffset += subsLimit;
      void loadSubscribers(true);
    });
  }
}

// --- Main Analytics Loader ---

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

    // Save and render registration dynamics
    rawDynamicsData = Array.isArray(payload.registration_dynamics) ? payload.registration_dynamics : [];
    const activeTimeBtn = document.querySelector(".chart-time-btn.active");
    const activeDays = activeTimeBtn ? parseInt(activeTimeBtn.dataset.days, 10) : 30;
    updateDynamicsChart(rawDynamicsData, activeDays);

    // Render static charts
    updateSubscriptionChart(payload.overview || {});
    updateGoalsChart(Array.isArray(payload.goal_breakdown) ? payload.goal_breakdown : []);
    updateStatusesChart(Array.isArray(payload.current_status_breakdown) ? payload.current_status_breakdown : []);

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
  initTimeframeSelector();
  initUserSearch();
  initTabSwitcher();
  initSubscribersTab();

  void loadAdminAnalytics();
  window.setInterval(() => {
    void loadAdminAnalytics();
  }, 30000);
});


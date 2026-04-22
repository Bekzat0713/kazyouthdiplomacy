function formatBirthDate(value) {
  if (!value) {
    return "-";
  }

  var parts = String(value).split("-");
  if (parts.length !== 3) {
    return value;
  }

  return [parts[2], parts[1], parts[0]].join(".");
}

function formatDateValue(value) {
  if (!value) {
    return "-";
  }

  var date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatCurrency(value) {
  var amount = Number(value || 0);
  return amount.toLocaleString("ru-RU") + " ₸";
}

function formatPreviewLimits(previewLimits) {
  if (!previewLimits) {
    return "";
  }

  return "Лимиты Free: "
    + String(previewLimits.internships || 0)
    + " стажировок, "
    + String(previewLimits.opportunities || 0)
    + " возможностей и "
    + String(previewLimits.resources || 0)
    + " материалов.";
}

function renderProfile(profile, fallbackEmail) {
  var profileName = document.getElementById("dashboardProfileName");
  var profileEmail = document.getElementById("dashboardProfileEmail");
  var profileBirthDate = document.getElementById("dashboardProfileBirthDate");
  var profileUniversity = document.getElementById("dashboardProfileUniversity");
  var profileWorkplace = document.getElementById("dashboardProfileWorkplace");
  var verifyBadge = document.getElementById("dashboardVerifyBadge");

  if (!profileName || !profileEmail || !profileBirthDate || !profileUniversity || !profileWorkplace || !verifyBadge) {
    return;
  }

  var fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();

  profileName.textContent = fullName || "Профиль пользователя";
  profileEmail.textContent = profile.email || fallbackEmail || "-";
  profileBirthDate.textContent = formatBirthDate(profile.birth_date);
  profileUniversity.textContent = profile.university || "-";
  profileWorkplace.textContent = profile.workplace || "Не указано";
  verifyBadge.textContent = profile.is_verified ? "Почта подтверждена" : "Почта не подтверждена";
  verifyBadge.classList.toggle("dashboard-badge-warning", !profile.is_verified);
}

function renderSubscription(subscription, accessTier, accessPolicy) {
  var subscriptionText = document.getElementById("dashboardSubscriptionText");
  if (!subscriptionText) {
    return;
  }

  var limitsText = accessPolicy ? formatPreviewLimits(accessPolicy.preview_limits) : "";

  if (!subscription) {
    subscriptionText.textContent = accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message + " " + limitsText
      : "Сейчас у вас Free. Можно смотреть часть базы и часть материалов, а Plus открывает полный каталог, персональный roadmap, подборки и сохранения.";
    return;
  }

  if (subscription.active) {
    subscriptionText.textContent = "Сейчас у вас Plus до " + formatDateValue(subscription.expires_at) + ". Полный каталог, рекомендации и рабочие инструменты уже доступны.";
    return;
  }

  if (subscription.status === "pending_manual_review") {
    subscriptionText.textContent = accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message + " " + limitsText
      : "Оплата отправлена на проверку. До подтверждения действует только Free, а Plus включится автоматически после подтверждения.";
    return;
  }

  if (subscription.status === "payment_pending") {
    subscriptionText.textContent = "Сумма для активации Plus подготовлена: "
      + formatCurrency(subscription.amount || subscription.base_amount || 0)
      + ". Пока оплата не подтверждена, доступ остаётся на уровне Free. "
      + limitsText;
    return;
  }

  if (subscription.status === "rejected") {
    subscriptionText.textContent = "Заявка отклонена. " + (subscription.review_note || "Проверьте оплату и отправьте новую заявку.");
    return;
  }

  if (subscription.status === "expired") {
    subscriptionText.textContent = accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message + " " + limitsText
      : "Срок Plus закончился. Free остаётся доступным, а полный доступ можно продлить в разделе подписки.";
    return;
  }

  if (accessTier === "free") {
    subscriptionText.textContent = accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message + " " + limitsText
      : "Сейчас у вас Free. Можно смотреть часть базы и часть материалов, а Plus открывает полный каталог, персональный roadmap, подборки и сохранения.";
    return;
  }

  subscriptionText.textContent = "Текущий статус подписки: " + subscription.status + ".";
}

function renderRoadmap(roadmap, roadmapPreview, featureAccess) {
  var roadmapCard = document.getElementById("dashboardRoadmapCard");
  var roadmapSummary = document.getElementById("dashboardRoadmapSummary");
  var roadmapGoal = document.getElementById("dashboardRoadmapGoal");
  var roadmapBlocker = document.getElementById("dashboardRoadmapBlocker");
  var roadmapEnglish = document.getElementById("dashboardRoadmapEnglish");
  var roadmapExperience = document.getElementById("dashboardRoadmapExperience");
  var roadmapNextTitle = document.getElementById("dashboardRoadmapNextTitle");
  var roadmapNextDescription = document.getElementById("dashboardRoadmapNextDescription");
  var roadmapNextLink = document.getElementById("dashboardRoadmapNextLink");
  var roadmapSteps = document.getElementById("dashboardRoadmapSteps");

  if (
    !roadmapCard ||
    !roadmapSummary ||
    !roadmapGoal ||
    !roadmapBlocker ||
    !roadmapEnglish ||
    !roadmapExperience ||
    !roadmapNextTitle ||
    !roadmapNextDescription ||
    !roadmapNextLink ||
    !roadmapSteps
  ) {
    return;
  }

  if (!roadmap && featureAccess && featureAccess.roadmap === false) {
    roadmapCard.hidden = false;
    roadmapSummary.textContent = roadmapPreview && roadmapPreview.description
      ? roadmapPreview.description
      : "Персональный roadmap открывается на Plus.";
    roadmapGoal.textContent = "Доступно в Plus";
    roadmapBlocker.textContent = "Нужен апгрейд";
    roadmapEnglish.textContent = "Откроется в Plus";
    roadmapExperience.textContent = "Откроется в Plus";
    roadmapNextTitle.textContent = roadmapPreview && roadmapPreview.title
      ? roadmapPreview.title
      : "Персональный roadmap доступен в Plus";
    roadmapNextDescription.textContent = "На Plus вы получаете персональный маршрут, подборки под цель и карьерные инструменты.";
    roadmapNextLink.textContent = "Открыть Plus";
    roadmapNextLink.href = "/subscribe";
    roadmapSteps.innerHTML = "";
    return;
  }

  if (!roadmap) {
    roadmapCard.hidden = true;
    return;
  }

  var nextStep = roadmap.next_step || {};

  roadmapCard.hidden = false;
  roadmapSummary.textContent = roadmap.summary || "Маршрут скоро появится.";
  roadmapGoal.textContent = roadmap.goal_label || "-";
  roadmapBlocker.textContent = roadmap.blocker_label || "-";
  roadmapEnglish.textContent = roadmap.english_label || "-";
  roadmapExperience.textContent = roadmap.experience_label || "-";
  roadmapNextTitle.textContent = nextStep.title || "Следующий шаг пока уточняется";
  roadmapNextDescription.textContent = nextStep.description || "Скоро здесь появится персональная рекомендация.";
  roadmapNextLink.textContent = nextStep.cta_label || "Открыть раздел";
  roadmapNextLink.href = nextStep.cta_href || "/dashboard";
  roadmapSteps.innerHTML = "";

  (roadmap.steps || []).forEach(function (step, index) {
    var stepElement = document.createElement("article");
    stepElement.className = "dashboard-roadmap-step";

    var title = document.createElement("strong");
    title.textContent = (index + 1) + ". " + (step.title || "Шаг");

    var description = document.createElement("p");
    description.textContent = step.description || "";

    stepElement.appendChild(title);
    stepElement.appendChild(description);

    if (step.cta_href && step.cta_label) {
      var link = document.createElement("a");
      link.href = step.cta_href;
      link.className = "dashboard-roadmap-link";
      link.textContent = step.cta_label;
      stepElement.appendChild(link);
    }

    roadmapSteps.appendChild(stepElement);
  });
}

function renderSavedSummary(payload) {
  var savedBadge = document.getElementById("dashboardSavedBadge");
  var savedText = document.getElementById("dashboardSavedText");
  var savedCountSaved = document.getElementById("dashboardSavedCountSaved");
  var savedCountWant = document.getElementById("dashboardSavedCountWant");
  var savedCountApplied = document.getElementById("dashboardSavedCountApplied");
  var savedCountDeadlines = document.getElementById("dashboardSavedCountDeadlines");
  var savedDeadlines = document.getElementById("dashboardSavedDeadlines");

  if (
    !savedBadge ||
    !savedText ||
    !savedCountSaved ||
    !savedCountWant ||
    !savedCountApplied ||
    !savedCountDeadlines ||
    !savedDeadlines
  ) {
    return;
  }

  var summary = payload && payload.summary ? payload.summary : {};
  var counts = summary.counts || {};
  var upcomingDeadlines = Array.isArray(summary.upcoming_deadlines) ? summary.upcoming_deadlines : [];
  var total = Number(counts.total || 0);

  savedBadge.textContent = total + (total === 1 ? " сохранение" : " сохранений");
  savedCountSaved.textContent = String(counts.saved || 0);
  savedCountWant.textContent = String(counts.want_to_apply || 0);
  savedCountApplied.textContent = String(counts.applied || 0);
  savedCountDeadlines.textContent = String(upcomingDeadlines.length);

  if (payload && payload.upgrade_required) {
    savedBadge.textContent = "Доступно в Plus";
    savedText.textContent = payload.upgrade_message || "Избранное, статусы откликов и дедлайны доступны в Plus.";
    savedCountSaved.textContent = "0";
    savedCountWant.textContent = "0";
    savedCountApplied.textContent = "0";
    savedCountDeadlines.textContent = "0";
    savedDeadlines.innerHTML = "";
    return;
  }

  if (!total) {
    savedText.textContent = "Пока ничего не сохранено. Отмечайте стажировки и гранты, чтобы собрать свой трек и не потерять дедлайны.";
    savedDeadlines.innerHTML = "";
    return;
  }

  savedText.textContent = upcomingDeadlines.length
    ? "Ближайшие дедлайны, к которым стоит вернуться в первую очередь."
    : "Сохранения уже работают. Теперь можно отмечать, что хотите податься или уже подались.";

  savedDeadlines.innerHTML = "";
  if (!upcomingDeadlines.length) {
    return;
  }

  upcomingDeadlines.slice(0, 4).forEach(function (item) {
    var article = document.createElement("article");
    article.className = "dashboard-saved-item";

    var title = document.createElement("strong");
    title.textContent = item.title || "Сохранённый элемент";

    var meta = document.createElement("p");
    meta.textContent = (item.organization || "Без организации")
      + " • "
      + (item.deadline_date || "Без даты")
      + " • "
      + (typeof item.days_left === "number" ? ("осталось " + item.days_left + " дн.") : "следите за дедлайном");

    var link = document.createElement("a");
    link.href = item.page_path || "/dashboard";
    link.className = "dashboard-roadmap-link";
    link.textContent = item.saved_status === "applied" ? "Открыть и обновить статус" : "Открыть и проверить";

    article.appendChild(title);
    article.appendChild(meta);
    article.appendChild(link);
    savedDeadlines.appendChild(article);
  });
}

async function loadSavedSummary() {
  try {
    var response = await fetch("/api/saved?limit=20", {
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    var payload = await response.json();
    renderSavedSummary(payload);
  } catch (error) {
    console.error("Failed to load saved summary:", error);
  }
}

function renderCareerProfileSummary(payload) {
  var badge = document.getElementById("dashboardCareerBadge");
  var text = document.getElementById("dashboardCareerText");
  var projects = document.getElementById("dashboardCareerProjects");
  var skills = document.getElementById("dashboardCareerSkills");
  var links = document.getElementById("dashboardCareerLinks");
  var certificates = document.getElementById("dashboardCareerCertificates");
  var publicLink = document.getElementById("dashboardCareerPublicLink");

  if (!badge || !text || !projects || !skills || !links || !certificates || !publicLink) {
    return;
  }

  var summary = payload && payload.summary ? payload.summary : {};
  var urls = payload && payload.urls ? payload.urls : {};
  var isPublic = payload && payload.public_enabled === true;

  badge.textContent = String(summary.completion_percent || 0) + "%";
  projects.textContent = String(summary.projects_count || 0);
  skills.textContent = String(summary.skills_count || 0);
  links.textContent = String(summary.links_count || 0);
  certificates.textContent = String(summary.certificates_count || 0);
  text.textContent = isPublic
    ? "Публичная страница включена. QR уже может вести работодателя на вашу карьерную визитку."
    : "Пока это черновик. Заполните ключевые блоки и включите public mode, когда будете готовы.";

  publicLink.hidden = !isPublic;
  publicLink.href = urls.public_url || "#";
}

async function loadCareerProfileSummary() {
  try {
    var response = await fetch("/api/career-profile", {
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    var payload = await response.json();
    renderCareerProfileSummary(payload);
  } catch (error) {
    console.error("Failed to load career profile summary:", error);
  }
}

async function loadAccountAccess() {
  var publicationsTab = document.getElementById("dashboardPublicationsTab");
  var publicationsCard = document.getElementById("dashboardPublicationsCard");
  var subscriptionReviewTab = document.getElementById("dashboardSubscriptionReviewTab");
  var subscriptionReviewCard = document.getElementById("dashboardSubscriptionReviewCard");
  var analyticsTab = document.getElementById("dashboardAnalyticsTab");
  var analyticsCard = document.getElementById("dashboardAnalyticsCard");

  if (publicationsTab) {
    publicationsTab.hidden = true;
  }

  if (publicationsCard) {
    publicationsCard.hidden = true;
  }

  if (subscriptionReviewTab) {
    subscriptionReviewTab.hidden = true;
  }

  if (subscriptionReviewCard) {
    subscriptionReviewCard.hidden = true;
  }

  if (analyticsTab) {
    analyticsTab.hidden = true;
  }

  if (analyticsCard) {
    analyticsCard.hidden = true;
  }

  try {
    var response = await fetch("/api/account/access", {
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    var payload = await response.json();
    var canManagePublications = Boolean(payload.can_manage_opportunities);

    if (publicationsTab) {
      publicationsTab.hidden = !canManagePublications;
    }

    if (publicationsCard) {
      publicationsCard.hidden = !canManagePublications;
    }

    var canManageSubscriptions = Boolean(payload.can_manage_subscriptions);
    if (subscriptionReviewTab) {
      subscriptionReviewTab.hidden = !canManageSubscriptions;
    }

    if (subscriptionReviewCard) {
      subscriptionReviewCard.hidden = !canManageSubscriptions;
    }

    var canViewAdminAnalytics = Boolean(payload.can_view_admin_analytics);
    if (analyticsTab) {
      analyticsTab.hidden = !canViewAdminAnalytics;
    }

    if (analyticsCard) {
      analyticsCard.hidden = !canViewAdminAnalytics;
    }

    if (payload.profile) {
      renderProfile(payload.profile, payload.email);
    }

    renderRoadmap(payload.roadmap, payload.roadmap_preview, payload.feature_access);
    renderSubscription(payload.subscription, payload.access_tier, payload.access_policy);
  } catch (error) {
    console.error("Failed to load account access:", error);
  }
}

var dashboardRefreshTimer = null;

function refreshDashboardData() {
  if (document.visibilityState === "hidden") {
    return;
  }

  void loadAccountAccess();
  void loadSavedSummary();
  void loadCareerProfileSummary();
}

function startDashboardPolling() {
  if (dashboardRefreshTimer !== null) {
    window.clearInterval(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = window.setInterval(function () {
    refreshDashboardData();
  }, 20000);
}

document.addEventListener("DOMContentLoaded", function () {
  refreshDashboardData();
  startDashboardPolling();

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      refreshDashboardData();
    }
  });
});

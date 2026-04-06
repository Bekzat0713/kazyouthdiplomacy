const statusContainer = document.getElementById("subscription-status");
const noteContainer = document.getElementById("subscription-note");
const prepareButtons = Array.from(document.querySelectorAll("[data-prepare-plan]"));
const submitButtons = Array.from(document.querySelectorAll("[data-submit-plan]"));
const kaspiLinks = Array.from(document.querySelectorAll("[data-kaspi-link]"));
const paymentInfoMap = new Map(
  Array.from(document.querySelectorAll("[data-payment-info]")).map((node) => [node.getAttribute("data-payment-info"), node])
);
const planCardMap = new Map(
  Array.from(document.querySelectorAll("[data-plan-card]")).map((node) => [node.getAttribute("data-plan-card"), node])
);
const planActionMap = new Map(
  Array.from(document.querySelectorAll("[data-plan-actions]")).map((node) => [node.getAttribute("data-plan-actions"), node])
);
const FALLBACK_KASPI_QR_URL = "https://pay.kaspi.kz/pay/7tul3afi";
const DEFAULT_PLAN_HINT = "Нажмите «Оплатить Plus», и мы сразу подготовим точную сумму и откроем QR.";

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("ru-RU")} ₸`;
}

function formatPreviewLimits(previewLimits) {
  if (!previewLimits) {
    return "";
  }

  return `Free включает ${previewLimits.internships || 0} стажировок, ${previewLimits.opportunities || 0} возможностей и ${previewLimits.resources || 0} материалов.`;
}

function setStatus(message, isError = false) {
  if (!statusContainer) {
    return;
  }

  statusContainer.textContent = message;
  statusContainer.classList.toggle("error", Boolean(message) && isError);
  statusContainer.classList.toggle("success", Boolean(message) && !isError);
}

function setNote(message) {
  if (!noteContainer) {
    return;
  }

  noteContainer.textContent = message;
}

function setPlanSubmitAvailability(activePlan, enabled) {
  submitButtons.forEach((button) => {
    const plan = button.getAttribute("data-submit-plan");
    button.disabled = !enabled || plan !== activePlan;
  });
}

function setPrepareButtonsDisabled(disabled) {
  prepareButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function setPlanActionsVisibility(activePlan, visible) {
  planActionMap.forEach((node, plan) => {
    node.hidden = !visible || plan !== activePlan;
  });
}

function applyKaspiLink(url, activePlan) {
  const href = String(url || "").trim() || FALLBACK_KASPI_QR_URL;
  kaspiLinks.forEach((link) => {
    const plan = link.getAttribute("data-kaspi-link");
    link.href = href;
    link.hidden = !activePlan || plan !== activePlan;
  });
}

function resetPlanCards() {
  paymentInfoMap.forEach((node) => {
    node.textContent = DEFAULT_PLAN_HINT;
    node.classList.remove("ready");
  });

  planCardMap.forEach((card) => {
    card.classList.remove("plan-card-active");
  });

  setPlanSubmitAvailability(null, false);
  setPlanActionsVisibility(null, false);
  applyKaspiLink();
}

function renderPreparedPayment(subscription) {
  resetPlanCards();

  const planId = subscription.plan;
  const card = planCardMap.get(planId);
  const info = paymentInfoMap.get(planId);

  if (card) {
    card.classList.add("plan-card-active");
  }

  if (info) {
    const parts = [`Оплатите ровно ${formatAmount(subscription.amount || subscription.base_amount || 0)}.`];
    if (subscription.payment_code) {
      parts.push(`Код заявки: ${subscription.payment_code}.`);
    }
    parts.push("После оплаты вернитесь сюда и нажмите «Я оплатил».");
    info.textContent = parts.join(" ");
    info.classList.add("ready");
  }

  setPlanSubmitAvailability(planId, true);
  setPlanActionsVisibility(planId, true);
  applyKaspiLink(FALLBACK_KASPI_QR_URL, planId);
}

function renderSubscriptionState(payload) {
  const subscription = payload.subscription;
  const accessTier = payload.access_tier || "free";
  const accessPolicy = payload.access_policy || null;
  const kaspiUrl = payload.kaspi_qr_url || FALLBACK_KASPI_QR_URL;
  const limitsText = accessPolicy ? formatPreviewLimits(accessPolicy.preview_limits) : "";

  resetPlanCards();
  applyKaspiLink(kaspiUrl);
  setPrepareButtonsDisabled(false);

  if (!subscription) {
    setStatus(accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message
      : "Сейчас у вас Free. Можно смотреть часть базы и часть материалов, а Plus откроет полный каталог, roadmap, подборки и сохранения.");
    setNote((limitsText ? limitsText + " " : "") + "Клиентский сценарий простой: выберите Plus, оплатите QR и после оплаты нажмите только одну кнопку «Я оплатил».");
    return;
  }

  if (subscription.active) {
    setStatus(`Сейчас у вас Plus до ${formatDate(subscription.expires_at)}.`);
    setPrepareButtonsDisabled(true);
    setPlanSubmitAvailability(null, false);
    setPlanActionsVisibility(null, false);
    setNote("Полный каталог, roadmap, рекомендации и сохранения уже открыты. Когда срок закончится, здесь можно будет продлить доступ.");
    return;
  }

  if (subscription.status === "payment_pending") {
    renderPreparedPayment(subscription);
    applyKaspiLink(kaspiUrl, subscription.plan);
    setStatus("QR уже подготовлен. Оплатите точную сумму и потом нажмите «Я оплатил».");
    setNote("Повторно ничего создавать не нужно: система уже сохранила вашу заявку. До подтверждения оплаты у вас остаётся Free-доступ. " + limitsText);
    return;
  }

  if (subscription.status === "pending_manual_review") {
    renderPreparedPayment(subscription);
    setPrepareButtonsDisabled(true);
    setPlanSubmitAvailability(null, false);
    setPlanActionsVisibility(subscription.plan, true);
    applyKaspiLink(kaspiUrl, subscription.plan);
    setStatus(accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message
      : "Оплата отправлена на проверку. Как только платёж подтвердят, Plus включится автоматически.");
    setNote("С вашей стороны всё сделано. Дальше заявку видит админ и подтверждает платёж по точной сумме. До этого момента действует только Free. " + limitsText);
    return;
  }

  if (subscription.status === "rejected") {
    setStatus(`Заявка отклонена. ${subscription.review_note || "Проверьте оплату и создайте новую заявку."}`, true);
    setNote("Если оплата не совпала с подготовленной суммой, просто нажмите «Оплатить Plus» ещё раз и получите новую сумму.");
    return;
  }

  if (subscription.status === "expired") {
    setStatus(accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message
      : "Срок Plus закончился. Можно снова нажать «Оплатить Plus» и продлить доступ.");
    setNote((limitsText ? limitsText + " " : "") + "Полный каталог, roadmap и сохранения вернутся после повторной активации Plus.");
    return;
  }

  if (accessTier === "free") {
    setStatus(accessPolicy && accessPolicy.access_message
      ? accessPolicy.access_message
      : "Сейчас у вас Free. Можно смотреть часть базы и часть материалов, а Plus откроет полный каталог, roadmap, подборки и сохранения.");
    setNote((limitsText ? limitsText + " " : "") + "Клиентский сценарий простой: выберите Plus, оплатите QR и после оплаты нажмите только одну кнопку «Я оплатил».");
    return;
  }

  setStatus(`Текущий статус подписки: ${subscription.status}.`);
  setNote("Если статус выглядит странно, обновите страницу или создайте новую заявку на оплату.");
}

async function refreshSubscriptionStatus() {
  try {
    const response = await fetch("/api/subscription", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось получить статус подписки.");
    }

    renderSubscriptionState(payload);
  } catch (error) {
    resetPlanCards();
    setStatus(error.message || "Не удалось получить статус подписки.", true);
    console.error("Subscription status error:", error);
  }
}

async function preparePayment(plan) {
  setPrepareButtonsDisabled(true);
  setPlanSubmitAvailability(null, false);
  setPlanActionsVisibility(null, false);
  setStatus("Готовим оплату и открываем Kaspi QR...");

  try {
    const response = await fetch("/api/subscription/prepare", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ plan }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось подготовить оплату.");
    }

    if (payload.subscription) {
      renderPreparedPayment(payload.subscription);
    }

    applyKaspiLink(payload.kaspi_qr_url, plan);
    setPrepareButtonsDisabled(false);

    const paymentMessage = [
      `Оплатите ровно ${formatAmount(payload.exact_amount)}.`,
      payload.payment_code ? `Код заявки: ${payload.payment_code}.` : "",
      "Kaspi QR уже открыт в новой вкладке.",
    ].filter(Boolean).join(" ");

    setStatus(paymentMessage);
    setNote("После оплаты возвращайтесь сюда и нажмите только одну кнопку: «Я оплатил».");
    window.open(payload.kaspi_qr_url || FALLBACK_KASPI_QR_URL, "_blank", "noopener");
  } catch (error) {
    setPrepareButtonsDisabled(false);
    setStatus(error.message || "Не удалось подготовить оплату.", true);
    console.error("Subscription prepare error:", error);
  }
}

async function submitManualRequest(plan) {
  setPrepareButtonsDisabled(true);
  setPlanSubmitAvailability(null, false);
  setStatus("Отправляем заявку на проверку оплаты...");

  try {
    const response = await fetch("/api/subscription/manual-request", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ plan }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось отправить заявку.");
    }

    setStatus(payload.message || "Заявка отправлена.");
    setNote("Дальше клиенту ничего делать не нужно. Админ увидит заявку в очереди и подтвердит оплату по точной сумме. Пока заявка не подтверждена, у пользователя остаётся только Free-доступ.");
    await refreshSubscriptionStatus();
  } catch (error) {
    setPrepareButtonsDisabled(false);
    setStatus(error.message || "Не удалось отправить заявку.", true);
    console.error("Manual request error:", error);
    await refreshSubscriptionStatus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  prepareButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const plan = button.getAttribute("data-prepare-plan");
      if (!plan) {
        return;
      }
      void preparePayment(plan);
    });
  });

  submitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const plan = button.getAttribute("data-submit-plan");
      if (!plan) {
        return;
      }
      void submitManualRequest(plan);
    });
  });

  void refreshSubscriptionStatus();
  window.setInterval(() => {
    void refreshSubscriptionStatus();
  }, 15000);
});

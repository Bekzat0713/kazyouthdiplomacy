const statusContainer = document.getElementById("subscription-status");
const noteContainer = document.getElementById("subscription-note");
const prepareButtons = Array.from(document.querySelectorAll("[data-prepare-plan]"));
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

const kaspiWidget = document.getElementById("kaspi-widget");
const kaspiWidgetBackdrop = document.getElementById("kaspi-widget-backdrop");
const kaspiWidgetFrame = document.getElementById("kaspi-widget-frame");
const kaspiWidgetMeta = document.getElementById("kaspi-widget-meta");
const kaspiWidgetTitle = document.getElementById("kaspi-widget-title");
const kaspiWidgetOpenLink = document.getElementById("kaspi-widget-open-link");
const kaspiWidgetClose = document.getElementById("kaspi-widget-close");

const FALLBACK_KASPI_QR_URL = "https://pay.kaspi.kz/pay/7tul3afi";
const DEFAULT_PLAN_HINT = "Нажмите «Оплатить Plus», и мы сразу подготовим точную сумму, откроем QR и отправим заявку на проверку.";
const PLAN_WIDGET_LABELS = {
  monthly: "Kaspi QR • Plus Start",
  quarterly: "Kaspi QR • Plus Growth",
  halfyear: "Kaspi QR • Plus Long Run",
};
const DEFAULT_SUBSCRIBE_STATUS = "Выберите Plus, оплатите точную сумму по QR и дождитесь подтверждения доступа.";
const DEFAULT_SUBSCRIBE_NOTE = "Сразу после оплаты заявка попадёт в очередь проверки, а Plus включится после подтверждения.";

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ru-RU");
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("ru-RU")} ₸`;
}

function formatPreviewLimits(previewLimits) {
  if (!previewLimits) {
    return "";
  }

  return `До активации Plus доступно ${previewLimits.internships || 0} стажировок, ${previewLimits.opportunities || 0} возможностей и ${previewLimits.resources || 0} материалов.`;
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

function updateKaspiWidgetLink(url) {
  const href = String(url || "").trim() || FALLBACK_KASPI_QR_URL;
  if (kaspiWidgetOpenLink) {
    kaspiWidgetOpenLink.href = href;
  }
  return href;
}

function applyKaspiLink(url, activePlan) {
  const href = updateKaspiWidgetLink(url);

  kaspiLinks.forEach((link) => {
    const plan = link.getAttribute("data-kaspi-link");
    link.href = href;
    link.hidden = !activePlan || plan !== activePlan;
  });
}

function setKaspiWidgetOpen(isOpen) {
  if (!kaspiWidget || !kaspiWidgetBackdrop) {
    return;
  }

  kaspiWidget.hidden = !isOpen;
  kaspiWidgetBackdrop.hidden = !isOpen;
  kaspiWidget.setAttribute("aria-hidden", String(!isOpen));
  document.body.classList.toggle("kaspi-widget-open", isOpen);

  window.requestAnimationFrame(() => {
    kaspiWidget.classList.toggle("active", isOpen);
    kaspiWidgetBackdrop.classList.toggle("active", isOpen);
  });
}

function closeKaspiWidget() {
  setKaspiWidgetOpen(false);
}

function openKaspiWidget(url, options = {}) {
  if (!kaspiWidget || !kaspiWidgetFrame) {
    return;
  }

  const href = updateKaspiWidgetLink(url);
  const title = PLAN_WIDGET_LABELS[options.plan] || "Kaspi QR • Plus";
  const metaParts = [];

  if (options.amount) {
    metaParts.push(`Сумма к оплате: ${formatAmount(options.amount)}.`);
  }

  if (options.paymentCode) {
    metaParts.push(`Код заявки: ${options.paymentCode}.`);
  }

  metaParts.push("Заявка уже отправлена в очередь проверки. После оплаты просто дождитесь подтверждения.");

  if (kaspiWidgetTitle) {
    kaspiWidgetTitle.textContent = title;
  }

  if (kaspiWidgetMeta) {
    kaspiWidgetMeta.textContent = metaParts.join(" ");
  }

  if (kaspiWidgetFrame.src !== href) {
    kaspiWidgetFrame.src = href;
  }

  setKaspiWidgetOpen(true);
}

function resetPlanCards() {
  paymentInfoMap.forEach((node) => {
    node.textContent = DEFAULT_PLAN_HINT;
    node.classList.remove("ready");
  });

  planCardMap.forEach((card) => {
    card.classList.remove("plan-card-active");
  });

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

    parts.push("Kaspi QR откроется справа на этой странице, а заявка уже стоит в очереди на проверку.");
    info.textContent = parts.join(" ");
    info.classList.add("ready");
  }

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
    closeKaspiWidget();
    setStatus(DEFAULT_SUBSCRIBE_STATUS);
    setNote(`${limitsText ? `${limitsText} ` : ""}${DEFAULT_SUBSCRIBE_NOTE}`.trim());
    return;
  }

  if (subscription.active) {
    closeKaspiWidget();
    setStatus(`Сейчас у вас Plus до ${formatDate(subscription.expires_at)}.`);
    setPrepareButtonsDisabled(true);
    setPlanActionsVisibility(null, false);
    setNote("Полный каталог, roadmap, рекомендации и сохранения уже открыты. Когда срок закончится, здесь можно будет продлить доступ.");
    return;
  }

  if (subscription.status === "payment_pending") {
    renderPreparedPayment(subscription);
    applyKaspiLink(kaspiUrl, subscription.plan);
    setStatus("Kaspi QR уже подготовлен. После оплаты заявка автоматически попадёт на проверку.");
    setNote(`Ничего дополнительно нажимать не нужно. После поступления оплаты админ увидит заявку и подтвердит доступ. ${limitsText}`.trim());
    return;
  }

  if (subscription.status === "pending_manual_review") {
    renderPreparedPayment(subscription);
    setPrepareButtonsDisabled(true);
    setPlanActionsVisibility(subscription.plan, true);
    applyKaspiLink(kaspiUrl, subscription.plan);
    setStatus("Заявка уже отправлена на проверку. Как только платёж подтвердят, Plus включится автоматически.");
    setNote(`С вашей стороны всё сделано: QR уже доступен, а заявка стоит в очереди проверки. После оплаты остаётся только дождаться подтверждения. ${limitsText}`.trim());
    return;
  }

  if (subscription.status === "rejected") {
    closeKaspiWidget();
    setStatus(`Заявка отклонена. ${subscription.review_note || "Проверьте оплату и создайте новую заявку."}`, true);
    setNote("Если оплата не совпала с подготовленной суммой, просто нажмите «Оплатить Plus» ещё раз и получите новую сумму.");
    return;
  }

  if (subscription.status === "expired") {
    closeKaspiWidget();
    setStatus("Срок Plus закончился. Можно снова нажать «Оплатить Plus» и продлить доступ.");
    setNote(`${limitsText ? `${limitsText} ` : ""}Полный каталог, roadmap и сохранения вернутся после повторной активации Plus.`.trim());
    return;
  }

  if (accessTier === "free") {
    closeKaspiWidget();
    setStatus(DEFAULT_SUBSCRIBE_STATUS);
    setNote(`${limitsText ? `${limitsText} ` : ""}${DEFAULT_SUBSCRIBE_NOTE}`.trim());
    return;
  }

  closeKaspiWidget();
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
    closeKaspiWidget();
    setStatus(error.message || "Не удалось получить статус подписки.", true);
    console.error("Subscription status error:", error);
  }
}

async function preparePayment(plan) {
  setPrepareButtonsDisabled(true);
  setPlanActionsVisibility(null, false);
  setStatus("Готовим оплату, открываем Kaspi QR и отправляем заявку на проверку...");

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
    openKaspiWidget(payload.kaspi_qr_url, {
      plan,
      amount: payload.exact_amount,
      paymentCode: payload.payment_code,
    });

    const paymentMessage = [
      `Оплатите ровно ${formatAmount(payload.exact_amount)}.`,
      payload.payment_code ? `Код заявки: ${payload.payment_code}.` : "",
      "Kaspi QR уже открыт справа, а заявка сразу ушла на проверку.",
    ]
      .filter(Boolean)
      .join(" ");

    setStatus(paymentMessage);
    setNote("После оплаты ничего дополнительно нажимать не нужно. Доступ включится после подтверждения.");
  } catch (error) {
    setPrepareButtonsDisabled(false);
    setStatus(error.message || "Не удалось подготовить оплату.", true);
    console.error("Subscription prepare error:", error);
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

  kaspiLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openKaspiWidget(link.href, {
        plan: link.getAttribute("data-kaspi-link"),
      });
    });
  });

  kaspiWidgetClose?.addEventListener("click", closeKaspiWidget);
  kaspiWidgetBackdrop?.addEventListener("click", closeKaspiWidget);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && kaspiWidget && !kaspiWidget.hidden) {
      closeKaspiWidget();
    }
  });

  void refreshSubscriptionStatus();
  window.setInterval(() => {
    void refreshSubscriptionStatus();
  }, 15000);
});

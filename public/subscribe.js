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
const pageHomeArrow = document.querySelector(".page-home-arrow");
const runtime = window.KYD_RUNTIME;

const FALLBACK_KASPI_QR_URL = runtime ? runtime.getKaspiQrUrl() : "";
const DEFAULT_PLAN_HINT = "Нажмите «Оплатить Plus», и мы сразу подготовим точную сумму, переведём вас на Kaspi QR и отправим заявку на проверку.";
const DEFAULT_SUBSCRIBE_STATUS = "Выберите Plus, оплатите точную сумму по Kaspi QR и дождитесь подтверждения доступа.";
const DEFAULT_SUBSCRIBE_NOTE = "Сразу после оплаты заявка попадёт в очередь проверки, а Plus включится после подтверждения.";
const DEFAULT_PREPARE_LABEL = "Оплатить Plus";
const OPEN_QR_LABEL = "Открыть Kaspi QR";
const GUEST_PREPARE_LABEL = "Создать аккаунт и продолжить";
const GUEST_SUBSCRIBE_STATUS = "Тарифы и цены открыты без входа. Чтобы оплатить Plus и включить полный доступ, сначала создайте аккаунт.";
const GUEST_SUBSCRIBE_NOTE = "После короткого опроса и регистрации вы вернётесь к выбору тарифа и сможете сразу перейти к оплате через Kaspi QR.";
const GUEST_PLAN_HINT = "Сначала создайте аккаунт, а затем вернитесь к выбранному тарифу и оплатите Plus через Kaspi QR.";

let subscriptionRefreshTimer = null;

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

  return `До активации Plus доступ к закрытым разделам не откроется.`;
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

function resolveKaspiUrl(url) {
  return String(url || "").trim() || FALLBACK_KASPI_QR_URL;
}

function resetPrepareButtons() {
  prepareButtons.forEach((button) => {
    button.disabled = false;
    button.textContent = DEFAULT_PREPARE_LABEL;
    button.dataset.actionMode = "prepare";
    button.dataset.kaspiUrl = "";
    button.dataset.amount = "";
    button.dataset.paymentCode = "";
  });
}

function setPreparedPlanButton(plan, options = {}) {
  const kaspiUrl = resolveKaspiUrl(options.kaspiUrl);
  const amount = options.amount != null ? String(options.amount) : "";
  const paymentCode = options.paymentCode != null ? String(options.paymentCode) : "";

  prepareButtons.forEach((button) => {
    const isActivePlan = button.getAttribute("data-prepare-plan") === plan;
    button.disabled = false;
    button.textContent = isActivePlan ? OPEN_QR_LABEL : DEFAULT_PREPARE_LABEL;
    button.dataset.actionMode = isActivePlan ? "open_qr" : "prepare";
    button.dataset.kaspiUrl = isActivePlan ? kaspiUrl : "";
    button.dataset.amount = isActivePlan ? amount : "";
    button.dataset.paymentCode = isActivePlan ? paymentCode : "";
  });
}

function setPlanActionsVisibility(activePlan, visible) {
  planActionMap.forEach((node, plan) => {
    node.hidden = !visible || plan !== activePlan;
  });
}

function applyKaspiLink(url, activePlan) {
  const href = resolveKaspiUrl(url);

  kaspiLinks.forEach((link) => {
    const plan = link.getAttribute("data-kaspi-link");
    link.href = href || "#";
    link.hidden = !activePlan || plan !== activePlan;
  });

  return href;
}

function navigateToKaspi(url) {
  const href = resolveKaspiUrl(url);
  if (!href) {
    setStatus("Ссылка на оплату Kaspi QR пока не настроена.", true);
    return;
  }

  window.location.assign(href);
}

function navigateToRegistration(plan) {
  const params = new URLSearchParams();

  if (plan) {
    params.set("plan", plan);
  }

  params.set("source", "subscribe");
  window.location.assign(`/register-survey?${params.toString()}`);
}

function setBackArrowTarget(href, label) {
  if (!pageHomeArrow) {
    return;
  }

  pageHomeArrow.href = href;
  pageHomeArrow.setAttribute("aria-label", label);
}

function stopRefreshTimer() {
  if (subscriptionRefreshTimer !== null) {
    window.clearInterval(subscriptionRefreshTimer);
    subscriptionRefreshTimer = null;
  }
}

function ensureRefreshTimer() {
  if (subscriptionRefreshTimer !== null) {
    return;
  }

  subscriptionRefreshTimer = window.setInterval(() => {
    void refreshSubscriptionStatus();
  }, 15000);
}

function resetPlanCards() {
  resetPrepareButtons();

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

function renderGuestState() {
  stopRefreshTimer();
  resetPlanCards();
  setBackArrowTarget("/", "Вернуться на главную");
  setStatus(GUEST_SUBSCRIBE_STATUS);
  setNote(GUEST_SUBSCRIBE_NOTE);

  paymentInfoMap.forEach((node) => {
    node.textContent = GUEST_PLAN_HINT;
    node.classList.remove("ready");
  });

  prepareButtons.forEach((button) => {
    button.disabled = false;
    button.textContent = GUEST_PREPARE_LABEL;
    button.dataset.actionMode = "guest_register";
    button.dataset.kaspiUrl = "";
    button.dataset.amount = "";
    button.dataset.paymentCode = "";
  });
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

    parts.push("После нажатия на кнопку вы сразу перейдёте к Kaspi QR, а заявка уже стоит в очереди на проверку.");
    info.textContent = parts.join(" ");
    info.classList.add("ready");
  }

  setPlanActionsVisibility(planId, true);
  applyKaspiLink(FALLBACK_KASPI_QR_URL, planId);
  setPreparedPlanButton(planId, {
    kaspiUrl: FALLBACK_KASPI_QR_URL,
    amount: subscription.amount || subscription.base_amount || "",
    paymentCode: subscription.payment_code || "",
  });
}

function renderSubscriptionState(payload) {
  const subscription = payload.subscription;
  const accessTier = payload.access_tier || "free";
  const accessPolicy = payload.access_policy || null;
  const kaspiUrl = payload.kaspi_qr_url || FALLBACK_KASPI_QR_URL;
  const limitsText = accessPolicy ? formatPreviewLimits(accessPolicy.preview_limits) : "";

  ensureRefreshTimer();
  resetPlanCards();
  setBackArrowTarget("/dashboard", "Вернуться в кабинет");
  applyKaspiLink(kaspiUrl);
  setPrepareButtonsDisabled(false);

  if (!subscription) {
    setStatus(DEFAULT_SUBSCRIBE_STATUS);
    setNote(`${limitsText ? `${limitsText} ` : ""}${DEFAULT_SUBSCRIBE_NOTE}`.trim());
    return;
  }

  if (subscription.active) {
    setStatus(`Сейчас у вас Plus до ${formatDate(subscription.expires_at)}.`);
    setPrepareButtonsDisabled(true);
    setPlanActionsVisibility(null, false);
    setNote("Полный каталог, roadmap, рекомендации и сохранения уже открыты. Когда срок закончится, здесь можно будет продлить доступ.");
    return;
  }

  if (subscription.status === "payment_pending") {
    renderPreparedPayment(subscription);
    applyKaspiLink(kaspiUrl, subscription.plan);
    setPreparedPlanButton(subscription.plan, {
      kaspiUrl,
      amount: subscription.amount || subscription.base_amount || "",
      paymentCode: subscription.payment_code || "",
    });
    setStatus("Kaspi QR уже подготовлен. После оплаты заявка автоматически попадёт на проверку.");
    setNote("Ничего дополнительно нажимать не нужно. Если захотите другой тариф, просто выберите его заново — мы пересоберём сумму и заменим текущую заявку.");
    return;
  }

  if (subscription.status === "pending_manual_review") {
    renderPreparedPayment(subscription);
    setPlanActionsVisibility(subscription.plan, true);
    applyKaspiLink(kaspiUrl, subscription.plan);
    setPreparedPlanButton(subscription.plan, {
      kaspiUrl,
      amount: subscription.amount || subscription.base_amount || "",
      paymentCode: subscription.payment_code || "",
    });
    setStatus("Заявка уже отправлена на проверку. Как только платёж подтвердят, Plus включится автоматически.");
    setNote("С вашей стороны всё сделано: QR доступен по кнопке, а заявка уже стоит в очереди проверки. Если нужен другой тариф, можно выбрать его прямо сейчас — мы заменим текущую заявку на новую.");
    return;
  }

  if (subscription.status === "rejected") {
    setStatus(`Заявка отклонена. ${subscription.review_note || "Проверьте оплату и создайте новую заявку."}`, true);
    setNote("Если оплата не совпала с подготовленной суммой, просто нажмите «Оплатить Plus» ещё раз и получите новую сумму.");
    return;
  }

  if (subscription.status === "expired") {
    setStatus("Срок Plus закончился. Можно снова нажать «Оплатить Plus» и продлить доступ.");
    setNote("Полный каталог, roadmap и сохранения вернутся после повторной активации Plus.");
    return;
  }

  if (accessTier === "free") {
    setStatus(DEFAULT_SUBSCRIBE_STATUS);
    setNote(`${limitsText ? `${limitsText} ` : ""}${DEFAULT_SUBSCRIBE_NOTE}`.trim());
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
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      renderGuestState();
      return;
    }

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
  setPlanActionsVisibility(null, false);
  setStatus("Готовим оплату, переводим на Kaspi QR и отправляем заявку на проверку...");

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

    if (response.status === 401) {
      navigateToRegistration(plan);
      return;
    }

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
      "Сейчас вы перейдёте на Kaspi QR, а заявка уже отправлена на проверку.",
    ]
      .filter(Boolean)
      .join(" ");

    setStatus(paymentMessage);
    setNote("После оплаты ничего дополнительно нажимать не нужно. Если захотите сменить тариф до подтверждения, просто выберите другой план — заявка обновится.");
    navigateToKaspi(payload.kaspi_qr_url);
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

      if (button.dataset.actionMode === "open_qr") {
        navigateToKaspi(button.dataset.kaspiUrl);
        return;
      }

      if (button.dataset.actionMode === "guest_register") {
        navigateToRegistration(plan);
        return;
      }

      void preparePayment(plan);
    });
  });

  kaspiLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateToKaspi(link.href);
    });
  });

  void refreshSubscriptionStatus();
});

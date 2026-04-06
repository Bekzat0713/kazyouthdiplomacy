const reviewGrid = document.getElementById("subscriptionReviewGrid");
const reviewEmpty = document.getElementById("subscriptionReviewEmpty");
const reviewStatus = document.getElementById("subscriptionReviewStatus");

function formatDateTime(value) {
  if (!value) {
    return "Не указано";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} ₸`;
}

function setReviewStatus(message, isError = false) {
  if (!reviewStatus) {
    return;
  }

  reviewStatus.textContent = message;
  reviewStatus.classList.toggle("error", Boolean(message) && isError);
  reviewStatus.classList.toggle("success", Boolean(message) && !isError);
}

function createMetaBadge(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function createReviewCard(request) {
  const card = document.createElement("article");
  card.className = "opportunity-card";

  const badge = document.createElement("div");
  badge.className = "badge purple";
  badge.textContent = "Kaspi QR";
  card.appendChild(badge);

  const title = document.createElement("h3");
  title.textContent = `${request.first_name || ""} ${request.last_name || ""}`.trim() || request.email;
  card.appendChild(title);

  const org = document.createElement("p");
  org.className = "opportunity-org";
  org.textContent = request.email;
  card.appendChild(org);

  const amount = document.createElement("p");
  amount.className = "subscription-review-amount";
  amount.textContent = `Искать платёж на сумму ${formatAmount(request.amount)}.`;
  card.appendChild(amount);

  const summary = document.createElement("p");
  const details = [
    `Тариф: ${request.plan}.`,
    request.base_amount ? `Базовая цена: ${formatAmount(request.base_amount)}.` : "",
    request.payment_code ? `Код заявки: ${request.payment_code}.` : "",
    `Вуз: ${request.university || "Не указан"}.`,
    `Работа: ${request.workplace || "Не указано"}.`,
  ].filter(Boolean);
  summary.textContent = details.join(" ");
  card.appendChild(summary);

  const meta = document.createElement("div");
  meta.className = "opportunity-meta";
  meta.appendChild(createMetaBadge(`Подготовлено: ${formatDateTime(request.prepared_at)}`));
  meta.appendChild(createMetaBadge(`Отправлено: ${formatDateTime(request.submitted_at)}`));
  meta.appendChild(createMetaBadge(`Доступ: ${request.access_days || 0} дней`));
  card.appendChild(meta);

  const approveButton = document.createElement("button");
  approveButton.className = "btn primary";
  approveButton.type = "button";
  approveButton.textContent = "Подтвердить";
  approveButton.addEventListener("click", () => {
    void reviewRequest(request.id, "approve");
  });
  card.appendChild(approveButton);

  const rejectButton = document.createElement("button");
  rejectButton.className = "btn danger-btn";
  rejectButton.type = "button";
  rejectButton.textContent = "Отклонить";
  rejectButton.addEventListener("click", () => {
    const reviewNote = window.prompt("Причина отклонения", "Платёж не найден в Kaspi.");
    if (reviewNote === null) {
      return;
    }
    void reviewRequest(request.id, "reject", reviewNote);
  });
  card.appendChild(rejectButton);

  return card;
}

function renderReviewQueue(requests) {
  if (!reviewGrid || !reviewEmpty) {
    return;
  }

  reviewGrid.innerHTML = "";

  if (!requests.length) {
    reviewEmpty.hidden = false;
    return;
  }

  reviewEmpty.hidden = true;
  const fragment = document.createDocumentFragment();
  requests.forEach((request, index) => {
    const card = createReviewCard(request);
    card.classList.add("surface-reveal");
    card.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 70}ms`);
    fragment.appendChild(card);
  });
  reviewGrid.appendChild(fragment);

  window.requestAnimationFrame(() => {
    reviewGrid.querySelectorAll(".surface-reveal").forEach((card) => {
      card.classList.add("surface-reveal-visible");
    });
  });
}

async function loadReviewQueue() {
  setReviewStatus("Загружаем заявки...");

  try {
    const response = await fetch("/api/subscription/review-queue", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить заявки.");
    }

    renderReviewQueue(Array.isArray(payload.requests) ? payload.requests : []);
    setReviewStatus("");
  } catch (error) {
    setReviewStatus(error.message || "Не удалось загрузить заявки.", true);
    console.error("Review queue load error:", error);
  }
}

async function reviewRequest(subscriptionId, action, reviewNote) {
  setReviewStatus(action === "approve" ? "Подтверждаем оплату..." : "Отклоняем заявку...");

  try {
    const response = await fetch(`/api/subscription/review/${subscriptionId}/${action}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ reviewNote }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Не удалось обновить заявку.");
    }

    setReviewStatus(payload.message || "Заявка обновлена.");
    await loadReviewQueue();
  } catch (error) {
    setReviewStatus(error.message || "Не удалось обновить заявку.", true);
    console.error("Review request error:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadReviewQueue();
  window.setInterval(() => {
    void loadReviewQueue();
  }, 15000);
});

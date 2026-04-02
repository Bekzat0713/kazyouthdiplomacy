async function refreshSubscriptionStatus() {
  const statusContainer = document.getElementById("subscription-status");
  try {
    const resp = await fetch("/api/subscription", { credentials: "include" });
    const json = await resp.json();

    if (resp.ok) {
      if (!json.hasSubscription) {
        statusContainer.innerText = "У вас нет активной подписки. Доступ к контенту ограничен.";
      } else {
        const { subscription } = json;
        if (subscription.active) {
          statusContainer.innerText = `Подписка активна до ${new Date(subscription.expires_at).toLocaleDateString()}`;
        } else {
          statusContainer.innerText = `Есть подписка в статусе ${subscription.status}, оплатите снова.`;
        }
      }
    } else {
      statusContainer.innerText = `Ошибка получения статуса подписки: ${json.error || resp.status}`;
    }
  } catch (err) {
    statusContainer.innerText = "Не удалось получить статус подписки через сервер.";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  refreshSubscriptionStatus();
});

async function loadAccountAccess() {
  const publicationsTab = document.getElementById("dashboardPublicationsTab");
  const publicationsCard = document.getElementById("dashboardPublicationsCard");

  if (!publicationsTab || !publicationsCard) {
    return;
  }

  try {
    const response = await fetch("/api/account/access", {
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const canManagePublications = Boolean(payload.can_manage_opportunities);

    publicationsTab.hidden = !canManagePublications;
    publicationsCard.hidden = !canManagePublications;
  } catch (error) {
    console.error("Failed to load account access:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadAccountAccess();
});

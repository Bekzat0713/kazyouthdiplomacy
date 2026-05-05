(function () {
  var viewerStatePromise = null;
  var modalNodes = null;

  function buildGuestState() {
    return {
      isAuthenticated: false,
      accessTier: "guest",
      user: null,
      subscription: null,
      accessPolicy: null,
    };
  }

  function normalizeViewerState(payload) {
    var user = payload && payload.user ? payload.user : null;

    return {
      isAuthenticated: Boolean(payload && payload.is_authenticated),
      accessTier: String(payload && payload.access_tier || (user ? "free" : "guest")),
      user: user ? {
        id: Number(user.id),
        displayName: String(user.display_name || ""),
        firstName: String(user.first_name || ""),
        goalLabel: String(user.goal_label || ""),
        hasReview: Boolean(user.has_review),
        isSubscribed: Boolean(user.isSubscribed),
        hasPlusAccess: Boolean(user.has_plus_access),
        hasManagerAccess: Boolean(user.has_manager_access),
        hasFullAccess: Boolean(user.has_full_access),
      } : null,
      subscription: payload && payload.subscription ? payload.subscription : null,
      accessPolicy: payload && payload.access_policy ? payload.access_policy : null,
    };
  }

  function fetchViewerState(options) {
    var force = Boolean(options && options.force);

    if (!force && viewerStatePromise) {
      return viewerStatePromise;
    }

    viewerStatePromise = fetch("/api/viewer-state", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) {
          return buildGuestState();
        }

        return response.json().then(normalizeViewerState);
      })
      .catch(function () {
        return buildGuestState();
      });

    return viewerStatePromise;
  }

  function invalidateViewerState() {
    viewerStatePromise = null;
  }

  function ensureModal() {
    if (modalNodes) {
      return modalNodes;
    }

    var backdrop = document.createElement("div");
    var dialog = document.createElement("div");
    var header = document.createElement("div");
    var title = document.createElement("h2");
    var message = document.createElement("p");
    var actions = document.createElement("div");
    var closeButton = document.createElement("button");
    var ctaLink = document.createElement("a");

    backdrop.className = "access-modal-backdrop";
    backdrop.hidden = true;

    dialog.className = "access-modal";
    dialog.hidden = true;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "accessModalTitle");

    header.className = "access-modal-head";
    title.id = "accessModalTitle";
    title.className = "access-modal-title";
    message.className = "access-modal-message";
    actions.className = "access-modal-actions";

    closeButton.type = "button";
    closeButton.className = "btn secondary access-modal-close";
    closeButton.textContent = "Позже";

    ctaLink.className = "btn primary access-modal-cta";
    ctaLink.href = "/subscribe";
    ctaLink.textContent = "Оформить подписку";

    header.appendChild(title);
    dialog.appendChild(header);
    dialog.appendChild(message);
    actions.appendChild(closeButton);
    actions.appendChild(ctaLink);
    dialog.appendChild(actions);

    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);

    function closeModal() {
      backdrop.hidden = true;
      dialog.hidden = true;
      document.body.classList.remove("access-modal-open");
    }

    function openModal(config) {
      title.textContent = String(config && config.title || "Доступ ограничен");
      message.textContent = String(config && config.message || "Чтобы продолжить, нужен более высокий уровень доступа.");
      ctaLink.textContent = String(config && config.ctaLabel || "Оформить подписку");
      ctaLink.href = String(config && config.ctaHref || "/subscribe");

      backdrop.hidden = false;
      dialog.hidden = false;
      document.body.classList.add("access-modal-open");
    }

    backdrop.addEventListener("click", closeModal);
    closeButton.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modalNodes && !modalNodes.dialog.hidden) {
        closeModal();
      }
    });

    modalNodes = {
      backdrop: backdrop,
      dialog: dialog,
      title: title,
      message: message,
      ctaLink: ctaLink,
      open: openModal,
      close: closeModal,
    };

    return modalNodes;
  }

  function openSubscriptionModal(options) {
    ensureModal().open(options || {});
  }

  function closeSubscriptionModal() {
    if (modalNodes) {
      modalNodes.close();
    }
  }

  function requireAuth(options) {
    var redirectTo = String(options && options.redirectTo || "/register");

    return fetchViewerState()
      .then(function (state) {
        if (state.isAuthenticated) {
          return state;
        }

        if (redirectTo) {
          window.location.assign(redirectTo);
        }

        return null;
      });
  }

  function requireSubscription(options) {
    var unauthenticatedRedirect = String(options && options.unauthenticatedRedirect || "/register");

    return requireAuth({ redirectTo: unauthenticatedRedirect })
      .then(function (state) {
        if (!state) {
          return null;
        }

        if (state.user && (state.user.isSubscribed || state.user.hasFullAccess)) {
          return state;
        }

        openSubscriptionModal({
          title: options && options.title || "Подписка нужна для отклика",
          message: options && options.message || "Чтобы откликнуться, оформите подписку.",
          ctaLabel: options && options.ctaLabel || "Оформить подписку",
          ctaHref: options && options.ctaHref || "/subscribe",
        });
        return null;
      });
  }

  window.KYD_ACCESS = Object.freeze({
    fetchViewerState: fetchViewerState,
    invalidateViewerState: invalidateViewerState,
    requireAuth: requireAuth,
    requireSubscription: requireSubscription,
    openSubscriptionModal: openSubscriptionModal,
    closeSubscriptionModal: closeSubscriptionModal,
  });
})();

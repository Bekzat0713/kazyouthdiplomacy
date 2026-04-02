(function () {
  var TRANSITION_KEY = "kyd_route_transition_v1";
  var TRANSITION_DURATION_MS = 620;
  var TRANSITION_TTL_MS = 4500;

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function persistTransition(direction, href) {
    var payload = {
      direction: direction === "left" ? "left" : "right",
      href: href,
      ts: Date.now(),
    };
    sessionStorage.setItem(TRANSITION_KEY, JSON.stringify(payload));
  }

  function consumeTransitionIfFresh() {
    var raw = sessionStorage.getItem(TRANSITION_KEY);
    if (!raw) return null;

    sessionStorage.removeItem(TRANSITION_KEY);
    var payload = safeParse(raw);
    if (!payload || !payload.direction || !payload.ts) return null;
    if (Date.now() - Number(payload.ts) > TRANSITION_TTL_MS) return null;
    return payload;
  }

  function startOutTransition(direction, navigateTo) {
    var body = document.body;
    if (!body) {
      window.location.href = navigateTo;
      return;
    }

    if (body.classList.contains("route-transition-out-left") || body.classList.contains("route-transition-out-right")) {
      return;
    }

    body.classList.add(direction === "left" ? "route-transition-out-left" : "route-transition-out-right");

    window.setTimeout(function () {
      window.location.href = navigateTo;
    }, TRANSITION_DURATION_MS);
  }

  function bindRouteLinks() {
    var links = document.querySelectorAll(".route-link[data-transition-direction]");
    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var href = link.getAttribute("href");
        if (!href || href.charAt(0) === "#") return;

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.target && link.target !== "_self") return;

        event.preventDefault();
        var direction = link.getAttribute("data-transition-direction") || "right";
        persistTransition(direction, href);
        startOutTransition(direction, href);
      });
    });
  }

  function playInTransition() {
    var payload = consumeTransitionIfFresh();
    if (!payload) return;

    var body = document.body;
    if (!body || !body.classList.contains("route-page")) return;

    var className = payload.direction === "left"
      ? "route-transition-in-left"
      : "route-transition-in-right";

    body.classList.add(className);
    window.setTimeout(function () {
      body.classList.remove(className);
    }, TRANSITION_DURATION_MS);
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindRouteLinks();
    playInTransition();
  });
})();

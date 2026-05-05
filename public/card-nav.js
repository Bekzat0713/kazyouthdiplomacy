(function () {
  var mobileQuery = window.matchMedia("(max-width: 1100px)");

  function setMenuState(header, toggle, isOpen) {
    var nextOpen = Boolean(isOpen) && mobileQuery.matches;

    header.setAttribute("data-mobile-nav-open", nextOpen ? "true" : "false");
    toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    toggle.setAttribute("aria-label", nextOpen ? "Close menu" : "Open menu");
  }

  function initHeaderNav(header, index) {
    if (!header || header.dataset.cardNavInit === "true") {
      return;
    }

    var brand = header.querySelector(".logo-wrap");
    var nav = header.querySelector(".home-figma-nav");

    if (!brand || !nav) {
      return;
    }

    var toggle = document.createElement("button");
    var navId = nav.id || "siteNavMenu" + index;

    header.dataset.cardNavInit = "true";
    header.classList.add("card-nav-inline-header");

    nav.id = navId;
    nav.classList.add("card-nav-inline");
    nav.setAttribute("aria-label", "Main navigation");

    toggle.type = "button";
    toggle.className = "card-nav-toggle";
    toggle.setAttribute("aria-label", "Open menu");
    toggle.setAttribute("aria-controls", navId);
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span></span><span></span><span></span>';

    header.insertBefore(toggle, brand);
    setMenuState(header, toggle, false);

    toggle.addEventListener("click", function () {
      var isOpen = header.getAttribute("data-mobile-nav-open") === "true";
      setMenuState(header, toggle, !isOpen);
    });

    document.addEventListener("click", function (event) {
      if (!mobileQuery.matches || header.getAttribute("data-mobile-nav-open") !== "true") {
        return;
      }

      if (!header.contains(event.target)) {
        setMenuState(header, toggle, false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") {
        return;
      }

      if (header.getAttribute("data-mobile-nav-open") === "true") {
        setMenuState(header, toggle, false);
        toggle.focus();
      }
    });

    nav.querySelectorAll("a, button").forEach(function (item) {
      item.addEventListener("click", function () {
        setMenuState(header, toggle, false);
      });
    });

    nav.querySelectorAll("form").forEach(function (form) {
      form.addEventListener("submit", function () {
        setMenuState(header, toggle, false);
      });
    });

    function syncOnResize() {
      if (!mobileQuery.matches) {
        setMenuState(header, toggle, false);
      }
    }

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", syncOnResize);
    } else if (typeof mobileQuery.addListener === "function") {
      mobileQuery.addListener(syncOnResize);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".home-figma-header").forEach(initHeaderNav);
  });
})();

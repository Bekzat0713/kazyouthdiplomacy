(function () {
  function setPageScrollLocked(isLocked) {
    document.documentElement.classList.toggle("mobile-nav-lock", Boolean(isLocked));
    if (document.body) {
      document.body.classList.toggle("mobile-nav-lock", Boolean(isLocked));
    }
  }

  function setMenuState(header, toggle, isOpen, mobileQuery) {
    var nextOpen = Boolean(isOpen) && mobileQuery.matches;
    var nav = header.querySelector(".home-figma-nav");

    header.setAttribute("data-mobile-nav-open", nextOpen ? "true" : "false");
    toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    toggle.setAttribute("aria-label", nextOpen ? "Закрыть меню" : "Открыть меню");
    if (nav) {
      if (mobileQuery.matches) {
        nav.setAttribute("aria-hidden", nextOpen ? "false" : "true");
      } else {
        nav.removeAttribute("aria-hidden");
      }
    }
    setPageScrollLocked(nextOpen);
  }

  function initHeaderNav(header, index) {
    if (!header || header.dataset.cardNavInit === "true") {
      return;
    }

    var brand = header.querySelector(".logo-wrap");
    var nav = header.querySelector(".home-figma-nav");
    var isInnerPage = document.body && document.body.classList.contains("inner-premium-page");
    var mobileQuery = window.matchMedia(isInnerPage ? "(max-width: 991px)" : "(max-width: 1100px)");

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
    toggle.setAttribute("aria-label", "Открыть меню");
    toggle.setAttribute("aria-controls", navId);
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span></span><span></span><span></span>';

    header.insertBefore(toggle, brand);
    setMenuState(header, toggle, false, mobileQuery);

    toggle.addEventListener("click", function () {
      var isOpen = header.getAttribute("data-mobile-nav-open") === "true";
      setMenuState(header, toggle, !isOpen, mobileQuery);
      if (!isOpen) {
        var firstItem = nav.querySelector("a, button");
        if (firstItem) {
          window.setTimeout(function () { firstItem.focus(); }, 80);
        }
      }
    });

    document.addEventListener("click", function (event) {
      if (!mobileQuery.matches || header.getAttribute("data-mobile-nav-open") !== "true") {
        return;
      }

      if (!header.contains(event.target)) {
        setMenuState(header, toggle, false, mobileQuery);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (header.getAttribute("data-mobile-nav-open") === "true") {
          setMenuState(header, toggle, false, mobileQuery);
          toggle.focus();
        }
        return;
      }

      if (event.key !== "Tab" || header.getAttribute("data-mobile-nav-open") !== "true") {
        return;
      }

      var focusable = Array.prototype.slice.call(
        nav.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])')
      ).filter(function (item) {
        return item.offsetParent !== null;
      });

      if (!focusable.length) {
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        toggle.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        toggle.focus();
      } else if (event.shiftKey && document.activeElement === toggle) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === toggle) {
        event.preventDefault();
        first.focus();
      }
    });

    nav.querySelectorAll("a, button").forEach(function (item) {
      item.addEventListener("click", function () {
        setMenuState(header, toggle, false, mobileQuery);
      });
    });

    nav.querySelectorAll("form").forEach(function (form) {
      form.addEventListener("submit", function () {
        setMenuState(header, toggle, false, mobileQuery);
      });
    });

    function syncOnResize() {
      if (!mobileQuery.matches) {
        setMenuState(header, toggle, false, mobileQuery);
        nav.removeAttribute("aria-hidden");
      } else if (header.getAttribute("data-mobile-nav-open") !== "true") {
        nav.setAttribute("aria-hidden", "true");
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

  window.addEventListener("pagehide", function () {
    setPageScrollLocked(false);
  });
})();

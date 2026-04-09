// ===============================
// web.js - KazYouthDiplomacy
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 0) Intro splash on home page (2-3s), then reveal website.
  const splash = document.getElementById("site-splash");
  if (document.body.classList.contains("home-page") && splash) {
    const TRANSITION_KEY = "kyd_route_transition_v1";
    const TRANSITION_TTL_MS = 4500;
    let hasFreshRouteTransition = false;

    try {
      const raw = sessionStorage.getItem(TRANSITION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        hasFreshRouteTransition = Boolean(
          parsed &&
          parsed.ts &&
          Date.now() - Number(parsed.ts) <= TRANSITION_TTL_MS
        );
      }
    } catch (_error) {
      hasFreshRouteTransition = false;
    }

    if (hasFreshRouteTransition) {
      splash.remove();
      document.body.classList.add("splash-finished");
      return;
    }

    const splashDuration = prefersReducedMotion ? 700 : 2850;

    document.body.classList.add("splash-active");

    window.setTimeout(() => {
      document.body.classList.remove("splash-active");
      document.body.classList.add("splash-finished");

      window.setTimeout(() => {
        splash.remove();
      }, 900);
    }, splashDuration);
  }

  // 1) Smooth-scroll buttons in achievement sections (if present).
  const achievementButtons = document.querySelectorAll(".achievements-links button");

  achievementButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const section = document.getElementById(targetId);
      if (!section) return;

      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  // 2) Generic fade-in for cards on pages where these blocks exist.
  const fadeElements = document.querySelectorAll(
    ".achievement-card, .dashboard-card, .internship-modern, .opportunity-card, .plan-card, .cta-box"
  );
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const target = entry.target;
      target.classList.add("surface-reveal-visible");
      fadeObserver.unobserve(target);
    });
  }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });

  fadeElements.forEach((el, index) => {
    if (prefersReducedMotion) {
      el.classList.add("surface-reveal-visible");
      return;
    }

    el.classList.add("surface-reveal");
    el.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
    fadeObserver.observe(el);
  });

  // 3) Hero-bottom reveal on scroll (web.html).
  const revealSections = document.querySelectorAll("[data-scroll-reveal]");
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.remove("reveal-pending");
      entry.target.classList.add("reveal-visible");
      sectionObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.18,
    rootMargin: "0px 0px -10% 0px",
  });

  revealSections.forEach((section) => {
    if (prefersReducedMotion) {
      section.classList.add("reveal-visible");
      return;
    }

    section.classList.add("reveal-pending");
    sectionObserver.observe(section);
  });

  // 4) Smooth anchor navigation for the homepage storyboard.
  const inPageLinks = document.querySelectorAll('a[href^="#"]:not([href="#"])');

  inPageLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });

  // 5) Horizontal slide between overview and platform panels on the homepage.
  const showcaseShell = document.querySelector(".home-showcase-shell");
  const showcaseButtons = document.querySelectorAll("[data-showcase-switch]");

  if (showcaseShell && showcaseButtons.length) {
    const syncShowcaseButtons = (state) => {
      showcaseButtons.forEach((button) => {
        const isActive = button.dataset.showcaseSwitch === state;
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    syncShowcaseButtons(showcaseShell.dataset.showcaseState || "overview");

    showcaseButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextState = button.dataset.showcaseSwitch === "platform" ? "platform" : "overview";
        showcaseShell.dataset.showcaseState = nextState;
        syncShowcaseButtons(nextState);

        showcaseShell.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    });
  }
});

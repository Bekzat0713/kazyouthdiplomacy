// ===============================
// web.js - KazYouthDiplomacy
// ===============================

document.addEventListener("DOMContentLoaded", () => {
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

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    ".achievement-card, .dashboard-card, .internship-modern"
  );

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
      fadeObserver.unobserve(entry.target);
    });
  }, { threshold: 0.2 });

  fadeElements.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "all 0.7s ease";
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
    section.classList.add("reveal-pending");
    sectionObserver.observe(section);
  });

  // 4) Small hover lift for buttons.
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-3px)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
    });
  });
});

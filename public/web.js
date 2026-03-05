// ===============================
// web.js — KazYouthDiplomacy
// ===============================

document.addEventListener("DOMContentLoaded", () => {

  // =====================================
  // 1. Плавный скролл для достижений
  // =====================================
  const achievementButtons = document.querySelectorAll(".achievements-links button");

  achievementButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const section = document.getElementById(targetId);

      if (!section) return;

      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  // =====================================
  // 2. Анимация появления элементов
  // =====================================
  const fadeElements = document.querySelectorAll(
    ".achievement-card, .dashboard-card, .internship-modern, .cta-box"
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, { threshold: 0.2 });

  fadeElements.forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "all 0.7s ease";
    observer.observe(el);
  });

  // =====================================
  // 3. Фильтры стажировок (визуально)
  // =====================================
  const filters = document.querySelectorAll(".filter");

  filters.forEach(filter => {
    filter.addEventListener("click", () => {

      filters.forEach(btn => btn.classList.remove("active"));
      filter.classList.add("active");

      // Пока только визуально (логика потом)
    });
  });

  // =====================================
  // 4. Небольшой hover-эффект для кнопок
  // =====================================
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      btn.style.transform = "translateY(-3px)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translateY(0)";
    });
  });

});
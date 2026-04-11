(async function () {
  const grid = document.getElementById("coursesGrid");
  const addBtn = document.getElementById("addCourseBtn");
  const formCard = document.getElementById("courseFormCard");
  const cancelBtn = document.getElementById("cancelCourseBtn");
  const form = document.getElementById("courseForm");

  const ACCESS_LABELS = {
    0: "Free",
    1: "Plus Start",
    2: "Plus Growth",
    3: "Plus Long Run",
  };

  let canManage = false;

  async function loadCourses() {
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      canManage = data.can_manage;

      if (canManage) addBtn.hidden = false;

      if (!data.courses || data.courses.length === 0) {
        grid.innerHTML = '<p class="events-empty">Курсов пока нет.</p>';
        return;
      }

      grid.innerHTML = data.courses.map(course => renderCard(course)).join("");

      grid.querySelectorAll(".events-delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Удалить курс?")) return;
          await fetch(`/api/courses/${btn.dataset.id}`, { method: "DELETE" });
          loadCourses();
        });
      });

    } catch (err) {
      grid.innerHTML = '<p class="events-empty">Ошибка загрузки.</p>';
    }
  }

  function renderCard(course) {
    if (course.locked) {
      return `
        <article class="events-card events-card-locked">
          <div class="events-card-lock-icon">🔒</div>
          <div class="events-card-lock-copy">
            <strong>${course.title}</strong>
            <p>Доступно с плана <b>${ACCESS_LABELS[course.access_level]}</b></p>
            <a href="/subscribe" class="btn primary">Улучшить план →</a>
          </div>
        </article>
      `;
    }

    return `
      <article class="events-card">
        <div class="events-card-top">
          <span class="events-card-badge">${course.format === "online" ? "Онлайн" : "Офлайн"}</span>
          <span class="events-card-badge">${course.region_type === "international" ? "Зарубежные" : "Казахстан"}</span>
          <span class="events-card-badge">${course.is_paid ? "Платный" : "Бесплатный"}</span>
          ${course.access_level > 0 ? `<span class="events-card-badge events-card-badge-plus">${ACCESS_LABELS[course.access_level]}+</span>` : ""}
        </div>
        <strong class="events-card-title">${course.title}</strong>
        ${course.date ? `<span class="events-card-meta">📅 ${new Date(course.date).toLocaleDateString("ru-RU")}</span>` : ""}
        ${course.city || course.country ? `<span class="events-card-meta">📍 ${[course.city, course.country].filter(Boolean).join(", ")}</span>` : ""}
        ${course.english_level && course.english_level !== "any" ? `<span class="events-card-meta">🇬🇧 ${course.english_level.replace("_", "-").replace("c1_plus", "C1+").replace("a1_a2", "A1-A2").replace("b1_b2", "B1-B2")}</span>` : ""}
        <p class="events-card-desc">${course.description}</p>
        ${course.link ? `<a href="${course.link}" target="_blank" rel="noreferrer" class="btn secondary events-card-link">Перейти →</a>` : ""}
        ${canManage ? `<button class="events-delete-btn" data-id="${course.id}" type="button">Удалить</button>` : ""}
      </article>
    `;
  }

  addBtn.addEventListener("click", () => {
    formCard.hidden = false;
    formCard.scrollIntoView({ behavior: "smooth" });
  });

  cancelBtn.addEventListener("click", () => {
    formCard.hidden = true;
    form.reset();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const targetGoals = [...form.querySelectorAll('input[name="targetGoals"]:checked')].map(el => el.value);

    const body = {
      title: fd.get("title"),
      description: fd.get("description"),
      date: fd.get("date"),
      city: fd.get("city"),
      country: fd.get("country"),
      format: fd.get("format"),
      regionType: fd.get("regionType"),
      link: fd.get("link"),
      isPaid: fd.get("isPaid"),
      englishLevel: fd.get("englishLevel"),
      accessLevel: fd.get("accessLevel"),
      targetGoals,
    };

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed");
      form.reset();
      formCard.hidden = true;
      loadCourses();
    } catch (err) {
      alert("Ошибка при публикации. Попробуйте ещё раз.");
    }
  });

  loadCourses();
})();
(async function () {
  const grid = document.getElementById("eventsGrid");
  const addBtn = document.getElementById("addEventBtn");
  const formCard = document.getElementById("eventFormCard");
  const cancelBtn = document.getElementById("cancelEventBtn");
  const form = document.getElementById("eventForm");

  const ACCESS_LABELS = {
    0: "Free",
    1: "Plus Start",
    2: "Plus Growth",
    3: "Plus Long Run",
  };

  let canManage = false;

  async function loadEvents() {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      canManage = data.can_manage;

      if (canManage) addBtn.hidden = false;

      if (!data.events || data.events.length === 0) {
        grid.innerHTML = '<p class="events-empty">Мероприятий пока нет.</p>';
        return;
      }

      grid.innerHTML = data.events.map(event => renderCard(event)).join("");

      grid.querySelectorAll(".events-delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Удалить мероприятие?")) return;
          await fetch(`/api/events/${btn.dataset.id}`, { method: "DELETE" });
          loadEvents();
        });
      });

    } catch (err) {
      grid.innerHTML = '<p class="events-empty">Ошибка загрузки.</p>';
    }
  }

  function renderCard(event) {
    if (event.locked) {
      return `
        <article class="events-card events-card-locked">
          <div class="events-card-lock-icon">🔒</div>
          <div class="events-card-lock-copy">
            <strong>${event.title}</strong>
            <p>Доступно с плана <b>${ACCESS_LABELS[event.access_level]}</b></p>
            <a href="/subscribe" class="btn primary">Улучшить план →</a>
          </div>
        </article>
      `;
    }

    return `
      <article class="events-card">
        <div class="events-card-top">
          <span class="events-card-badge">${event.format === "online" ? "Онлайн" : "Офлайн"}</span>
          <span class="events-card-badge">${event.region_type === "international" ? "Зарубежные" : "Казахстан"}</span>
          ${event.access_level > 0 ? `<span class="events-card-badge events-card-badge-plus">${ACCESS_LABELS[event.access_level]}+</span>` : ""}
        </div>
        <strong class="events-card-title">${event.title}</strong>
        ${event.date ? `<span class="events-card-meta">📅 ${new Date(event.date).toLocaleDateString("ru-RU")}</span>` : ""}
        ${event.city || event.country ? `<span class="events-card-meta">📍 ${[event.city, event.country].filter(Boolean).join(", ")}</span>` : ""}
        <p class="events-card-desc">${event.description}</p>
        ${event.link ? `<a href="${event.link}" target="_blank" rel="noreferrer" class="btn secondary events-card-link">Перейти →</a>` : ""}
        ${canManage ? `<button class="events-delete-btn" data-id="${event.id}" type="button">Удалить</button>` : ""}
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
      englishLevel: fd.get("englishLevel"),
      accessLevel: fd.get("accessLevel"),
      targetGoals,
    };

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed");
      form.reset();
      formCard.hidden = true;
      loadEvents();
    } catch (err) {
      alert("Ошибка при публикации. Попробуйте ещё раз.");
    }
  });

  loadEvents();
})();